'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { createJob, pauseJob, resumeJob, cancelJob } from '@/services/jobsService';

import {
  Header,
  GenerationView,
  ProcessingOverlay,
  ResultsView,
  ToastProvider,
  useToast,
  ThemeProvider,
} from '@/components';

import { ProcessedPokemon, WorkflowMode } from '@/types';
import { useJobPolling } from '@/hooks/useJobPolling';
import { usePokemonData } from '@/hooks/usePokemonData';
import { useSavedData } from '@/hooks/useSavedData';

type GeneratorView = 'select' | 'processing' | 'results';

function GeneratorPageInner() {
  const { showToast } = useToast();
  const router = useRouter();

  const [currentView, setCurrentView] = useState<GeneratorView>('select');
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>(WorkflowMode.FULL);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  const [currentSummary, setCurrentSummary] = useState<string | null>(null);
  const [results, setResults] = useState<ProcessedPokemon[]>([]);

  const {
    generations,
    selectedGenId,
    currentRegion,
    pokemonList,
    isLoading,
    rangeStart,
    rangeEnd,
    setRangeStart,
    setRangeEnd,
    handleGenChange,
  } = usePokemonData();

  const { savedSummaries, savedAudioLogs, refreshData: refreshSavedData } = useSavedData();

  const {
    activeJobId,
    setActiveJobId,
    isProcessing,
    isPaused,
    progress,
    cooldown,
    setIsProcessing,
    setCooldown,
  } = useJobPolling({
    onJobComplete: (jobResults, mode) => {
      refreshSavedData();

      if (mode === 'SUMMARY_ONLY') {
        router.push('/library');
      } else {
        setResults(jobResults);
        setCurrentView('results');
      }
    },
    onJobCanceled: () => {
      setCurrentView('select');
    },
  });

  const toggleSelection = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
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
    setCurrentView('processing');

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
      setCurrentView('select');
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
    setCurrentView('select');
  };

  return (
    <div className="min-h-screen bg-transparent">
      <Header />

      <main className="pb-20">
        {currentView === 'select' && (
          <GenerationView
            mode={workflowMode}
            onModeChange={setWorkflowMode}
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

        {currentView === 'results' && (
          <ResultsView
            results={results}
            onClear={() => setResults([])}
            onBack={() => setCurrentView('select')}
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

export default function GeneratorPage() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <GeneratorPageInner />
      </ToastProvider>
    </ThemeProvider>
  );
}
