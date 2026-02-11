/**
 * Custom hook for polling job processing status and managing UI state.
 * Handles job progress tracking, cooldown states, and result compilation.
 */

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
      window.clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const fetchPokemonData = useCallback(
    async (pokemonId: number): Promise<{ imageUrl?: string; displayName?: string }> => {
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

      const hasAudio = audioMetaIds.has(id);
      const requiresAudio = job.mode !== 'SUMMARY_ONLY';
      if (requiresAudio && !hasAudio) continue;

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
      let shouldContinue = true;
      try {
        const job = await getJob(activeJobId);

        setIsProcessing(
          job.status === 'queued' || job.status === 'running' || job.status === 'paused'
        );
        setIsPaused(job.status === 'paused');

        const currentPokemonId = job.pokemonIds[job.current] || job.pokemonIds[job.current - 1];

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

        let currentPokemonImage: string | undefined;
        let currentPokemonName: string | undefined;
        if (currentPokemonId && !isInCooldown) {
          const pokemonData = await fetchPokemonData(currentPokemonId);
          currentPokemonImage = pokemonData.imageUrl;
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
          shouldContinue = false;
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
          shouldContinue = false;
          clearPoll();
          setActiveJobId(null);
          setIsProcessing(false);
          setCooldown(null);
          onJobCanceled?.();
        }

        if (job.status === 'completed') {
          shouldContinue = false;
          clearPoll();
          setActiveJobId(null);
          setIsProcessing(false);
          setCooldown(null);

          const results = await buildResultsForJob({
            generationId: job.generationId,
            pokemonIds: job.pokemonIds,
            mode: job.mode,
          });

          onJobComplete?.(results, job.mode);
        }
      } catch (e) {
        console.error('Failed to poll job:', e);
      } finally {
        if (shouldContinue) {
          pollTimer.current = window.setTimeout(poll, 1000);
        }
      }
    };

    void poll();

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
