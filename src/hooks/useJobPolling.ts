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

export function useJobPolling({
  onJobComplete,
  onJobFailed,
  onJobCanceled,
}: UseJobPollingProps = {}) {
  const { showToast } = useToast();
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    message: string;
    stage: 'summary' | 'audio';
  }>({ current: 0, total: 0, message: '', stage: 'summary' });
  const [cooldown, setCooldown] = useState<CooldownState | null>(null);
  const pollTimer = useRef<number | null>(null);

  const clearPoll = useCallback(() => {
    if (pollTimer.current) {
      window.clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const buildResultsForJob = async (job: {
    generationId: number;
    pokemonIds: number[];
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
      const hasAudio = audioMetaIds.has(id);
      if (!summary || !hasAudio) continue;

      // Fetch full audio data (with audioBase64) for results
      const audio = await getAudioLog(id);
      if (!audio) continue;

      const cachedPokemonRes = await fetch(`/api/pokemon/${id}`);
      const response = (await cachedPokemonRes.json().catch(() => null)) as {
        success: boolean;
        data?: {
          imagePngPath?: string | null;
          imageSvgPath?: string | null;
        };
      } | null;

      const cachedPokemon = response?.data || null;

      results.push({
        id,
        name: summary.name,
        summary: summary.summary,
        audioData: audio.audioBase64,
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

        setProgress({
          current: job.current,
          total: job.total,
          message: job.message,
          stage: job.stage,
        });

        if (job.cooldownUntil) {
          const remainingMs = Math.max(0, new Date(job.cooldownUntil).getTime() - Date.now());
          if (remainingMs > 0) {
            setCooldown({ active: true, remainingMs, flavorText: '' });
          } else {
            setCooldown(null);
          }
        } else {
          setCooldown(null);
        }

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

          // We don't load saved summaries/audio here directly as that's app state,
          // but we can optionally return results if needed.

          let results: ProcessedPokemon[] = [];
          if (job.mode !== 'SUMMARY_ONLY') {
            results = await buildResultsForJob(job);
          }

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
  }, [activeJobId, showToast, onJobComplete, onJobFailed, onJobCanceled, clearPoll]);

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
