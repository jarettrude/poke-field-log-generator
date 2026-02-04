'use client';

import {
  Header,
  AdminView,
  ToastProvider,
  ThemeProvider,
} from '@/components';

function AdminPageInner() {
  return (
    <div className="min-h-screen bg-transparent">
      <Header />

      <main className="pb-20">
        <AdminView />
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

export default function AdminPage() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AdminPageInner />
      </ToastProvider>
    </ThemeProvider>
  );
}
