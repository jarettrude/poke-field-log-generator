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
  deleteSummary,
  exportSummariesAsJSON,
  importSummariesFromJSON,
  StoredSummary,
  getAllAudioLogs,
  getAudioLogsByGeneration,
  StoredAudioLog,
  deleteAudioLog,
} from '@/services/storageService';

import {
  Header,
  HomeView,
  GenerationView,
  LibraryView,
  AdminView,
  ProcessingOverlay,
  ResultsView,
} from '@/components';

import {
  Generation,
  PokemonBaseInfo,
  ProcessedPokemon,
  WorkflowMode,
  AppView,
  CooldownState,
} from '@/types';

export default function Home() {
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
          alert(job.error || 'Job failed');
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
            setCurrentView(AppView.SUMMARY_LIBRARY);
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
  }, [activeJobId]);

  const loadSavedSummaries = async () => {
    const summaries = await getAllSummaries();
    setSavedSummaries(summaries);
  };

  const loadSavedAudioLogs = async () => {
    const audioLogs = await getAllAudioLogs();
    setSavedAudioLogs(audioLogs);
  };

  const handleDeleteAudioLog = async (id: number) => {
    await deleteAudioLog(id);
    await loadSavedAudioLogs();
  };

  const handleRegenerateAudioLog = async (id: number) => {
    const summary = savedSummaries.find(s => s.id === id);
    if (!summary) {
      alert('No saved summary found for this Pokémon. Generate a summary first.');
      return;
    }

    setIsProcessing(true);
    setProgress({ current: 0, total: 1, message: 'Queued...', stage: 'audio' });
    setCurrentView(AppView.PROCESSING);

    const jobId = await createJob({
      mode: 'AUDIO_ONLY',
      generationId: summary.generationId,
      region: summary.region,
      voice: selectedVoice,
      pokemonIds: [summary.id],
    });
    setActiveJobId(jobId);
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
      alert('Please select at least one Pokémon');
      return;
    }

    if (workflowMode === WorkflowMode.AUDIO_ONLY) {
      const summariesToProcess = savedSummaries.filter(s => targetIds.includes(s.id));
      if (summariesToProcess.length === 0) {
        alert('No saved summaries found for selected Pokémon. Generate summaries first.');
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
      alert(msg);
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

  const handleDeleteSummary = async (id: number) => {
    await deleteSummary(id);
    await loadSavedSummaries();
  };

  const handleExportSummaries = async () => {
    const json = await exportSummariesAsJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pokemon_summaries.json';
    a.click();
  };

  const handleImportSummaries = async (json: string) => {
    try {
      await importSummariesFromJSON(json);
      await loadSavedSummaries();
      alert('Summaries imported successfully!');
    } catch {
      alert('Failed to import summaries. Please check the file format.');
    }
  };

  const handleRegenerate = async (id: number) => {
    const existingSummary = savedSummaries.find(s => s.id === id);
    const region = existingSummary?.region ?? currentRegion;
    const genId = existingSummary?.generationId ?? selectedGenId;

    setIsProcessing(true);
    setProgress({ current: 0, total: 1, message: 'Queued...', stage: 'summary' });
    setCurrentView(AppView.PROCESSING);

    const jobId = await createJob({
      mode: 'SUMMARY_ONLY',
      generationId: genId,
      region,
      voice: selectedVoice,
      pokemonIds: [id],
    });
    setActiveJobId(jobId);
  };

  return (
    <div className="min-h-screen bg-slate-50">
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
          />
        )}

        {currentView === AppView.SUMMARY_LIBRARY && (
          <LibraryView
            summaries={savedSummaries}
            audioLogs={savedAudioLogs}
            onRefresh={loadSavedSummaries}
            onDelete={handleDeleteSummary}
            onRegenerate={handleRegenerate}
            onDeleteAudio={handleDeleteAudioLog}
            onRegenerateAudio={handleRegenerateAudioLog}
            onExport={handleExportSummaries}
            onImport={handleImportSummaries}
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

      <footer className="border-t border-slate-200 bg-white py-8 text-center">
        <p className="text-xs text-slate-400">Field Logs Generator &middot; Powered by Gemini AI</p>
      </footer>
    </div>
  );
}
