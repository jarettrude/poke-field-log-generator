import { useState, useRef, useEffect, useCallback } from 'react';
import { getJob } from '@/services/jobsService';
import { useToast } from '@/components/ToastProvider';
import {
  getSummariesByGeneration,
  getAudioLogsByGeneration,
  getAudioLog,
} from '@/services/storageService';
import { ProcessedPokemon, CooldownState } from '@/types';

interface UseJobPollingProps {
  onJobComplete?: (
    results: ProcessedPokemon[],
    mode: 'FULL' | 'SUMMARY_ONLY' | 'AUDIO_ONLY'
  ) => void;
  onJobFailed?: (error: string) => void;
  onJobCanceled?: () => void;
}

interface ProgressState {
  current: number;
  total: number;
  message: string;
  stage: 'summary' | 'audio';
  currentPokemonId?: number;
  currentPokemonName?: string;
  currentPokemonImage?: string;
}

export function useJobPolling({
  onJobComplete,
  onJobFailed,
  onJobCanceled,
}: UseJobPollingProps = {}) {
  const { showToast } = useToast();
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState<ProgressState>({
    current: 0,
    total: 0,
    message: '',
    stage: 'summary',
  });
  const [cooldown, setCooldown] = useState<CooldownState | null>(null);
  const pollTimer = useRef<number | null>(null);
  const pokemonDataCache = useRef<Map<number, { imageUrl?: string; displayName?: string }>>(
    new Map()
  );

  const clearPoll = useCallback(() => {
    if (pollTimer.current) {
      window.clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const fetchPokemonData = useCallback(
    async (pokemonId: number): Promise<{ imageUrl?: string; displayName?: string }> => {
      // Check cache first
      if (pokemonDataCache.current.has(pokemonId)) {
        return pokemonDataCache.current.get(pokemonId)!;
      }

      try {
        const response = await fetch(`/api/pokemon/${pokemonId}`);
        const result = (await response.json().catch(() => null)) as {
          success: boolean;
          data?: {
            imagePngPath?: string | null;
            imageSvgPath?: string | null;
            name?: string;
            displayName?: string;
          };
        } | null;

        const imageUrl = result?.data?.imagePngPath || result?.data?.imageSvgPath || undefined;
        const displayName = result?.data?.displayName || result?.data?.name || undefined;

        if (imageUrl || displayName) {
          pokemonDataCache.current.set(pokemonId, { imageUrl, displayName });
        }
        return { imageUrl, displayName };
      } catch {
        return {};
      }
    },
    []
  );

  const extractPokemonName = (message: string): string | undefined => {
    // Try to extract Pokemon name from message like "Generating summary for #1 Bulbasaur..."
    // or "Synthesizing audio for #1 bulbasaur..."
    const match = message.match(/#\d+\s+(\w+)/i);
    return match?.[1];
  };

  const buildResultsForJob = async (job: {
    generationId: number;
    pokemonIds: number[];
    mode: 'FULL' | 'SUMMARY_ONLY' | 'AUDIO_ONLY';
  }): Promise<ProcessedPokemon[]> => {
    const [summaries, audioLogsMeta] = await Promise.all([
      getSummariesByGeneration(job.generationId),
      getAudioLogsByGeneration(job.generationId),
    ]);

    const summaryById = new Map(summaries.map(s => [s.id, s] as const));
    const audioMetaIds = new Set(audioLogsMeta.map(a => a.id));

    const results: ProcessedPokemon[] = [];
    for (const id of job.pokemonIds) {
      const summary = summaryById.get(id);
      if (!summary) continue;

      // For SUMMARY_ONLY mode, audio is not required
      const hasAudio = audioMetaIds.has(id);
      const requiresAudio = job.mode !== 'SUMMARY_ONLY';
      if (requiresAudio && !hasAudio) continue;

      // Fetch audio data only if we have audio
      let audioData = '';
      if (hasAudio) {
        const audio = await getAudioLog(id);
        audioData = audio?.audioBase64 || '';
      }

      const cachedPokemonRes = await fetch(`/api/pokemon/${id}`);
      const response = (await cachedPokemonRes.json().catch(() => null)) as {
        success: boolean;
        data?: {
          imagePngPath?: string | null;
          imageSvgPath?: string | null;
          displayName?: string;
          variantCategory?: string;
        };
      } | null;

      const cachedPokemon = response?.data || null;

      results.push({
        id,
        name: summary.name,
        displayName: cachedPokemon?.displayName,
        summary: summary.summary,
        audioData: audioData,
        pngData: cachedPokemon?.imagePngPath || null,
        svgData: cachedPokemon?.imageSvgPath || null,
      });
    }

    return results;
  };

  useEffect(() => {
    if (!activeJobId) {
      clearPoll();
      return;
    }

    const poll = async () => {
      try {
        const job = await getJob(activeJobId);

        setIsProcessing(
          job.status === 'queued' || job.status === 'running' || job.status === 'paused'
        );
        setIsPaused(job.status === 'paused');

        // Get current Pokemon ID from the pokemonIds array
        const currentPokemonId = job.pokemonIds[job.current] || job.pokemonIds[job.current - 1];

        // Determine if we're in cooldown
        let isInCooldown = false;
        if (job.cooldownUntil) {
          const remainingMs = Math.max(0, new Date(job.cooldownUntil).getTime() - Date.now());
          if (remainingMs > 0) {
            isInCooldown = true;
            setCooldown({ active: true, remainingMs, flavorText: '' });
          } else {
            setCooldown(null);
          }
        } else {
          setCooldown(null);
        }

        // Fetch Pokemon data (only if not in cooldown)
        let currentPokemonImage: string | undefined;
        let currentPokemonName: string | undefined;
        if (currentPokemonId && !isInCooldown) {
          const pokemonData = await fetchPokemonData(currentPokemonId);
          currentPokemonImage = pokemonData.imageUrl;
          // Prefer displayName from cache, fall back to message extraction
          currentPokemonName = pokemonData.displayName || extractPokemonName(job.message);
        }

        setProgress({
          current: job.current,
          total: job.total,
          message: job.message,
          stage: job.stage,
          currentPokemonId: isInCooldown ? undefined : currentPokemonId,
          currentPokemonName: isInCooldown ? undefined : currentPokemonName,
          currentPokemonImage: isInCooldown ? undefined : currentPokemonImage,
        });

        if (job.status === 'failed') {
          clearPoll();
          setActiveJobId(null);
          setIsProcessing(false);
          setCooldown(null);
          const errorMsg = job.error || 'Something went wrong while processing your batch.';
          showToast({
            variant: 'error',
            title: 'Job failed',
            description: errorMsg,
            durationMs: 6500,
          });
          onJobFailed?.(errorMsg);
        }

        if (job.status === 'canceled') {
          clearPoll();
          setActiveJobId(null);
          setIsProcessing(false);
          setCooldown(null);
          onJobCanceled?.();
        }

        if (job.status === 'completed') {
          clearPoll();
          setActiveJobId(null);
          setIsProcessing(false);
          setCooldown(null);

          // Build results for all modes so they can be displayed in ResultsView
          const results = await buildResultsForJob({
            generationId: job.generationId,
            pokemonIds: job.pokemonIds,
            mode: job.mode,
          });

          onJobComplete?.(results, job.mode);
        }
      } catch (e) {
        console.error('Failed to poll job:', e);
      }
    };

    void poll();
    pollTimer.current = window.setInterval(poll, 1000);

    return () => {
      clearPoll();
    };
  }, [
    activeJobId,
    showToast,
    onJobComplete,
    onJobFailed,
    onJobCanceled,
    clearPoll,
    fetchPokemonData,
  ]);

  return {
    activeJobId,
    setActiveJobId,
    isProcessing,
    isPaused,
    progress,
    cooldown,
    setIsProcessing,
    setCooldown,
  };
}
