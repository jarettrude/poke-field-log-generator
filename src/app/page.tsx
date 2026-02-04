'use client';

import { Header, HomeView, ToastProvider, ThemeProvider } from '@/components';
import { useSavedData } from '@/hooks/useSavedData';

function HomePageInner() {
  const { savedSummaries, savedAudioLogs } = useSavedData();

  return (
    <div className="min-h-screen bg-transparent">
      <Header />

      <main className="pb-20">
        <HomeView summaryCount={savedSummaries.length} audioCount={savedAudioLogs.length} />
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

export default function HomePage() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <HomePageInner />
      </ToastProvider>
    </ThemeProvider>
  );
}
