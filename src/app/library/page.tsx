'use client';

import { deleteSummaries, deleteAudioLogs } from '@/services/storageService';
import {
  Header,
  PokedexLibraryView,
  ToastProvider,
  ThemeProvider,
} from '@/components';
import { useSavedData } from '@/hooks/useSavedData';

function LibraryPageInner() {
  const { savedSummaries, savedAudioLogs, refreshData } = useSavedData();

  return (
    <div className="min-h-screen bg-transparent">
      <Header />

      <main className="pb-20">
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
        />
      </main>

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
