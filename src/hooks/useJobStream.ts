/**
 * Custom hook for real-time job progress via Server-Sent Events (SSE).
 * Replaces useJobPolling — no HTTP polling, no heartbeats.
 *
 * Opens an EventSource to /api/jobs/:id/stream when activeJobId is set.
 * The server pushes progress/completed/failed/canceled events in real-time.
 * Result compilation still fetches from the REST API on terminal events.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  getSummariesByGeneration,
  getAudioLogsByGeneration,
  getAudioLog,
} from '@/services/storageService';
import { ProcessedPokemon, CooldownState } from '@/types';

interface UseJobStreamProps {
  onJobComplete?: (
    results: ProcessedPokemon[],
    mode: 'FULL' | 'SUMMARY_ONLY' | 'AUDIO_ONLY'
  ) => void;
  onJobFailed?: (
    error: string,
    partialResults: ProcessedPokemon[],
    mode: 'FULL' | 'SUMMARY_ONLY' | 'AUDIO_ONLY'
  ) => void;
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

interface SSEProgressEvent {
  type: 'progress';
  jobId: string;
  status: string;
  stage: 'summary' | 'audio';
  current: number;
  total: number;
  message: string;
  cooldownUntil: string | null;
}

interface SSECompletedEvent {
  type: 'completed';
  jobId: string;
  generationId: number;
  pokemonIds: number[];
  mode: 'FULL' | 'SUMMARY_ONLY' | 'AUDIO_ONLY';
}

interface SSEFailedEvent {
  type: 'failed';
  jobId: string;
  error: string;
  generationId: number;
  pokemonIds: number[];
  mode: 'FULL' | 'SUMMARY_ONLY' | 'AUDIO_ONLY';
}

interface SSECanceledEvent {
  type: 'canceled';
  jobId: string;
}

interface SSEPausedEvent {
  type: 'paused';
  jobId: string;
}

interface SSEResumedEvent {
  type: 'resumed';
  jobId: string;
}

type SSEEvent =
  | SSEProgressEvent
  | SSECompletedEvent
  | SSEFailedEvent
  | SSECanceledEvent
  | SSEPausedEvent
  | SSEResumedEvent;

export function useJobStream({
  onJobComplete,
  onJobFailed,
  onJobCanceled,
}: UseJobStreamProps = {}) {
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
  const eventSourceRef = useRef<EventSource | null>(null);
  const pokemonDataCache = useRef<Map<number, { imageUrl?: string; displayName?: string }>>(
    new Map()
  );
  const onJobCompleteRef = useRef(onJobComplete);
  const onJobFailedRef = useRef(onJobFailed);
  const onJobCanceledRef = useRef(onJobCanceled);
  useEffect(() => {
    onJobCompleteRef.current = onJobComplete;
    onJobFailedRef.current = onJobFailed;
    onJobCanceledRef.current = onJobCanceled;
  }, [onJobComplete, onJobFailed, onJobCanceled]);

  const closeStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
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

  const buildResultsForJob = useCallback(
    async (params: {
      generationId: number;
      pokemonIds: number[];
      mode: 'FULL' | 'SUMMARY_ONLY' | 'AUDIO_ONLY';
      includePartial?: boolean;
    }): Promise<ProcessedPokemon[]> => {
      const [summaries, audioLogsMeta] = await Promise.all([
        getSummariesByGeneration(params.generationId),
        getAudioLogsByGeneration(params.generationId),
      ]);

      const summaryById = new Map(summaries.map(s => [s.id, s] as const));
      const audioMetaIds = new Set(audioLogsMeta.map(a => a.id));

      const results: ProcessedPokemon[] = [];
      for (const id of params.pokemonIds) {
        const summary = summaryById.get(id);
        if (!summary) continue;

        const hasAudio = audioMetaIds.has(id);
        const requiresAudio = params.mode !== 'SUMMARY_ONLY';
        if (requiresAudio && !hasAudio && !params.includePartial) continue;

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
    },
    []
  );

  useEffect(() => {
    if (!activeJobId) {
      closeStream();
      return;
    }

    const es = new EventSource(`/api/jobs/${activeJobId}/stream`);
    eventSourceRef.current = es;

    es.onmessage = async event => {
      try {
        const data = JSON.parse(event.data) as SSEEvent;

        switch (data.type) {
          case 'progress': {
            setIsProcessing(true);
            setIsPaused(data.status === 'paused');

            const pokemonIdMatch = data.message.match(/#(\d+)/);
            const currentPokemonId = pokemonIdMatch?.[1]
              ? parseInt(pokemonIdMatch[1], 10)
              : undefined;

            if (data.cooldownUntil) {
              const remainingMs = Math.max(0, new Date(data.cooldownUntil).getTime() - Date.now());
              if (remainingMs > 0) {
                setCooldown({ active: true, remainingMs, flavorText: '' });
                setProgress({
                  current: data.current,
                  total: data.total,
                  message: data.message,
                  stage: data.stage,
                  currentPokemonId: undefined,
                  currentPokemonName: undefined,
                  currentPokemonImage: undefined,
                });
                break;
              }
            }
            setCooldown(null);

            let currentPokemonImage: string | undefined;
            let currentPokemonName: string | undefined;
            if (currentPokemonId) {
              const pokemonData = await fetchPokemonData(currentPokemonId);
              currentPokemonImage = pokemonData.imageUrl;
              currentPokemonName = pokemonData.displayName;
            }

            setProgress({
              current: data.current,
              total: data.total,
              message: data.message,
              stage: data.stage,
              currentPokemonId,
              currentPokemonName,
              currentPokemonImage,
            });
            break;
          }

          case 'completed': {
            closeStream();
            setActiveJobId(null);
            setIsProcessing(false);
            setCooldown(null);

            const results = await buildResultsForJob({
              generationId: data.generationId,
              pokemonIds: data.pokemonIds,
              mode: data.mode,
            });

            onJobCompleteRef.current?.(results, data.mode);
            break;
          }

          case 'failed': {
            closeStream();
            setActiveJobId(null);
            setIsProcessing(false);
            setCooldown(null);

            const partialResults = await buildResultsForJob({
              generationId: data.generationId,
              pokemonIds: data.pokemonIds,
              mode: data.mode,
              includePartial: true,
            });

            onJobFailedRef.current?.(data.error, partialResults, data.mode);
            break;
          }

          case 'canceled': {
            closeStream();
            setActiveJobId(null);
            setIsProcessing(false);
            setCooldown(null);
            onJobCanceledRef.current?.();
            break;
          }

          case 'paused': {
            setIsPaused(true);
            break;
          }

          case 'resumed': {
            setIsPaused(false);
            break;
          }
        }
      } catch (e) {
        console.error('Failed to parse SSE event:', e);
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects on error. If the stream was closed
      // intentionally (terminal event), eventSourceRef will be null.
      if (!eventSourceRef.current) return;
      console.warn('SSE connection error, will auto-reconnect...');
    };

    return () => {
      closeStream();
    };
  }, [activeJobId, closeStream, fetchPokemonData, buildResultsForJob]);

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
