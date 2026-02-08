'use client';

import { useState } from 'react';
import { deleteSummaries, deleteAudioLogs } from '@/services/storageService';
import { createJob, pauseJob, resumeJob, cancelJob } from '@/services/jobsService';
import {
  Header,
  PokedexLibraryView,
  ProcessingOverlay,
  ResultsView,
  ToastProvider,
  useToast,
  ThemeProvider,
} from '@/components';
import { ProcessedPokemon } from '@/types';
import { useSavedData } from '@/hooks/useSavedData';
import { useJobPolling } from '@/hooks/useJobPolling';

type LibraryView = 'library' | 'results';

function LibraryPageInner() {
  const { showToast } = useToast();
  const { savedSummaries, savedAudioLogs, refreshData } = useSavedData();
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  const [currentView, setCurrentView] = useState<LibraryView>('library');
  const [results, setResults] = useState<ProcessedPokemon[]>([]);

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
    onJobComplete: jobResults => {
      refreshData();
      if (jobResults.length > 0) {
        setResults(jobResults);
        setCurrentView('results');
      } else {
        setCurrentView('library');
        showToast({
          variant: 'warning',
          title: 'No results',
          description: 'Audio generation completed but produced no results.',
        });
      }
    },
    onJobCanceled: () => {
      setCurrentView('library');
      showToast({
        variant: 'warning',
        title: 'Audio generation canceled',
      });
    },
  });

  const handleGenerateAudio = async (ids: number[]) => {
    if (ids.length === 0) return;

    // Derive generationId and region from the first matching summary
    const firstSummary = savedSummaries.find(s => ids.includes(s.id));
    if (!firstSummary) {
      showToast({
        variant: 'error',
        title: 'No summaries found',
        description: 'Selected entries must have text summaries to generate audio.',
      });
      return;
    }

    setIsProcessing(true);

    try {
      const jobId = await createJob({
        mode: 'AUDIO_ONLY',
        generationId: firstSummary.generationId,
        region: firstSummary.region,
        voice: selectedVoice,
        pokemonIds: ids.sort((a, b) => a - b),
      });
      setActiveJobId(jobId);
    } catch (e) {
      setIsProcessing(false);
      const msg = e instanceof Error ? e.message : String(e);
      showToast({
        variant: 'error',
        title: 'Could not start audio generation',
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
    setCurrentView('library');
  };

  return (
    <div className="min-h-screen bg-transparent">
      <Header />

      <main className="pb-20">
        {currentView === 'library' && (
          <PokedexLibraryView
            summaries={savedSummaries}
            audioLogs={savedAudioLogs}
            onRefresh={refreshData}
            onDeleteSummaries={async (ids: number[]) => {
              await deleteSummaries(ids);
              await refreshData();
            }}
            onDeleteAudio={async (ids: number[]) => {
              await deleteAudioLogs(ids);
              await refreshData();
            }}
            onGenerateAudio={handleGenerateAudio}
            isGenerating={isProcessing}
            selectedVoice={selectedVoice}
            onVoiceChange={setSelectedVoice}
          />
        )}

        {currentView === 'results' && (
          <ResultsView
            results={results}
            onClear={() => {
              setResults([]);
              setCurrentView('library');
            }}
            onBack={() => {
              refreshData();
              setCurrentView('library');
            }}
          />
        )}
      </main>

      {isProcessing && (
        <ProcessingOverlay
          progress={progress}
          cooldown={cooldown}
          currentSummary={null}
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

export default function LibraryPage() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <LibraryPageInner />
      </ToastProvider>
    </ThemeProvider>
  );
}
