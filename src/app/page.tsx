'use client';

import { useState, useEffect, useRef } from 'react';

import {
  fetchGenerations,
  fetchPokemonInGeneration,
  fetchGenerationWithRegion,
} from '@/services/pokeService';
import { createJob, getJob, pauseJob, resumeJob, cancelJob } from '@/services/jobsService';
import {
  getSummariesByGeneration,
  getAllSummaries,
  StoredSummary,
  getAllAudioLogs,
  getAudioLogsByGeneration,
  StoredAudioLog,
  deleteSummaries,
  deleteAudioLogs,
} from '@/services/storageService';

import {
  Header,
  HomeView,
  GenerationView,
  PokedexLibraryView,
  AdminView,
  ProcessingOverlay,
  ResultsView,
  ToastProvider,
  useToast,
  ThemeProvider,
} from '@/components';

import {
  Generation,
  PokemonBaseInfo,
  ProcessedPokemon,
  WorkflowMode,
  AppView,
  CooldownState,
} from '@/types';

function HomeInner() {
  const { showToast } = useToast();

  const [currentView, setCurrentView] = useState<AppView>(AppView.HOME);
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>(WorkflowMode.FULL);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [selectedGenId, setSelectedGenId] = useState<number>(1);
  const [currentRegion, setCurrentRegion] = useState<string>('Kanto');
  const [pokemonList, setPokemonList] = useState<PokemonBaseInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [rangeStart, setRangeStart] = useState<number>(1);
  const [rangeEnd, setRangeEnd] = useState<number>(151);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    message: string;
    stage: 'summary' | 'audio';
  }>({ current: 0, total: 0, message: '', stage: 'summary' });
  const [cooldown, setCooldown] = useState<CooldownState | null>(null);
  const [currentSummary, setCurrentSummary] = useState<string | null>(null);
  const [results, setResults] = useState<ProcessedPokemon[]>([]);
  const [savedSummaries, setSavedSummaries] = useState<StoredSummary[]>([]);
  const [savedAudioLogs, setSavedAudioLogs] = useState<StoredAudioLog[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const pollTimer = useRef<number | null>(null);

  useEffect(() => {
    const init = async () => {
      const gens = await fetchGenerations();
      setGenerations(gens);
      if (gens.length > 0 && gens[0]?.id) {
        handleGenChange(gens[0].id);
      }
      await loadSavedSummaries();
      await loadSavedAudioLogs();
    };
    init();
  }, []);

  useEffect(() => {
    const clearPoll = () => {
      if (pollTimer.current) {
        window.clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    };

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
          showToast({
            variant: 'error',
            title: 'Job failed',
            description: job.error || 'Something went wrong while processing your batch.',
            durationMs: 6500,
          });
        }

        if (job.status === 'canceled') {
          clearPoll();
          setActiveJobId(null);
          setIsProcessing(false);
          setCooldown(null);
        }

        if (job.status === 'completed') {
          clearPoll();
          setActiveJobId(null);
          setIsProcessing(false);
          setCooldown(null);

          await loadSavedSummaries();
          await loadSavedAudioLogs();

          if (job.mode === 'SUMMARY_ONLY') {
            setCurrentView(AppView.POKEDEX_LIBRARY);
            return;
          }

          const resultsForJob = await buildResultsForJob(job);
          setResults(resultsForJob);
          setCurrentView(AppView.RESULTS);
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
  }, [activeJobId, showToast]);

  const loadSavedSummaries = async () => {
    const summaries = await getAllSummaries();
    setSavedSummaries(summaries);
  };

  const loadSavedAudioLogs = async () => {
    const audioLogs = await getAllAudioLogs();
    setSavedAudioLogs(audioLogs);
  };

  const handleGenChange = async (genId: number) => {
    setSelectedGenId(genId);
    setIsLoading(true);
    try {
      const [list, genInfo] = await Promise.all([
        fetchPokemonInGeneration(genId),
        fetchGenerationWithRegion(genId),
      ]);
      setPokemonList(list);
      setCurrentRegion(genInfo.region);
      setSearchQuery('');
      if (list.length > 0) {
        const ids = list.map(p => p.id);
        setRangeStart(Math.min(...ids));
        setRangeEnd(Math.max(...ids));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectMode = (mode: WorkflowMode) => {
    setWorkflowMode(mode);
    setCurrentView(AppView.GENERATION);
  };

  const toggleSelection = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const buildResultsForJob = async (job: {
    generationId: number;
    pokemonIds: number[];
  }): Promise<ProcessedPokemon[]> => {
    const [summaries, audioLogs] = await Promise.all([
      getSummariesByGeneration(job.generationId),
      getAudioLogsByGeneration(job.generationId),
    ]);

    const summaryById = new Map(summaries.map(s => [s.id, s] as const));
    const audioById = new Map(audioLogs.map(a => [a.id, a] as const));

    const results: ProcessedPokemon[] = [];
    for (const id of job.pokemonIds) {
      const summary = summaryById.get(id);
      const audio = audioById.get(id);
      if (!summary || !audio) continue;

      const cachedPokemonRes = await fetch(`/api/pokemon/${id}`);
      const cachedPokemon = (await cachedPokemonRes.json().catch(() => null)) as {
        imagePngPath?: string | null;
        imageSvgPath?: string | null;
      } | null;

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

  const handleStartProcess = async () => {
    let targetIds: number[];
    if (selectedIds.size > 0) {
      targetIds = Array.from(selectedIds) as number[];
      targetIds.sort((a, b) => a - b);
    } else {
      targetIds = [];
      for (let i = rangeStart; i <= rangeEnd; i++) {
        targetIds.push(i);
      }
    }

    if (targetIds.length === 0) {
      showToast({
        variant: 'warning',
        title: 'Nothing selected',
        description: 'Select at least one Pokémon (or set an ID range) to start.',
      });
      return;
    }

    if (workflowMode === WorkflowMode.AUDIO_ONLY) {
      const summariesToProcess = savedSummaries.filter(s => targetIds.includes(s.id));
      if (summariesToProcess.length === 0) {
        showToast({
          variant: 'warning',
          title: 'No saved summaries',
          description: 'Generate summaries first, then run Audio Only.',
        });
        return;
      }
    }

    setIsProcessing(true);
    setCurrentSummary(null);
    setProgress({ current: 0, total: 0, message: 'Queued...', stage: 'summary' });
    setCurrentView(AppView.PROCESSING);

    const mode =
      workflowMode === WorkflowMode.FULL
        ? 'FULL'
        : workflowMode === WorkflowMode.SUMMARY_ONLY
          ? 'SUMMARY_ONLY'
          : 'AUDIO_ONLY';

    try {
      const jobId = await createJob({
        mode,
        generationId: selectedGenId,
        region: currentRegion,
        voice: selectedVoice,
        pokemonIds: targetIds,
      });
      setActiveJobId(jobId);
    } catch (e) {
      setIsProcessing(false);
      const msg = e instanceof Error ? e.message : String(e);
      showToast({
        variant: 'error',
        title: 'Could not start job',
        description: msg,
        durationMs: 6500,
      });
    }
  };

  const handlePause = async () => {
    if (!activeJobId) return;
    await pauseJob(activeJobId);
  };

  const handleResume = async () => {
    if (!activeJobId) return;
    await resumeJob(activeJobId);
  };

  const handleCancel = async () => {
    if (!activeJobId) return;
    await cancelJob(activeJobId);
    setActiveJobId(null);
    setIsProcessing(false);
    setCooldown(null);
    setCurrentView(AppView.HOME);
  };

  return (
    <div className="min-h-screen bg-transparent">
      <Header onNavigate={setCurrentView} currentView={currentView} />

      <main className="pb-20">
        {currentView === AppView.HOME && (
          <HomeView
            onSelectMode={handleSelectMode}
            summaryCount={savedSummaries.length}
            audioCount={savedAudioLogs.length}
          />
        )}

        {currentView === AppView.GENERATION && (
          <GenerationView
            mode={workflowMode}
            generations={generations}
            selectedGenId={selectedGenId}
            onGenChange={handleGenChange}
            pokemonList={pokemonList}
            selectedIds={selectedIds}
            onToggleSelection={toggleSelection}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onRangeChange={(start, end) => {
              setRangeStart(start);
              setRangeEnd(end);
            }}
            selectedVoice={selectedVoice}
            onVoiceChange={setSelectedVoice}
            onStartProcess={handleStartProcess}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            isLoading={isLoading}
            savedSummaries={savedSummaries}
            savedAudioLogs={savedAudioLogs}
          />
        )}

        {currentView === AppView.POKEDEX_LIBRARY && (
          <PokedexLibraryView
            summaries={savedSummaries}
            audioLogs={savedAudioLogs}
            onRefresh={async () => {
              await loadSavedSummaries();
              await loadSavedAudioLogs();
            }}
            onDeleteSummaries={async (ids: number[]) => {
              await deleteSummaries(ids);
            }}
            onDeleteAudio={async (ids: number[]) => {
              await deleteAudioLogs(ids);
            }}
          />
        )}

        {currentView === AppView.ADMIN && <AdminView />}

        {currentView === AppView.RESULTS && (
          <ResultsView
            results={results}
            onClear={() => setResults([])}
            onBack={() => setCurrentView(AppView.HOME)}
          />
        )}
      </main>

      {isProcessing && (
        <ProcessingOverlay
          progress={progress}
          cooldown={cooldown}
          currentSummary={currentSummary}
          isPaused={isPaused}
          onPause={() => void handlePause()}
          onResume={() => void handleResume()}
          onCancel={() => void handleCancel()}
        />
      )}

      <footer
        className="border-t-2 py-8 text-center backdrop-blur"
        style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-elevated)' }}
      >
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          Field Logs Generator &middot; Powered by Gemini AI
        </p>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <HomeInner />
      </ToastProvider>
    </ThemeProvider>
  );
}
