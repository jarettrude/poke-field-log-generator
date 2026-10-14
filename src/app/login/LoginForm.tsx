'use client';

import { BookMarked, Loader2, LogIn } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';

interface LoginFormProps {
  next: string;
}

export const LoginForm: React.FC<LoginFormProps> = ({ next }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const body = (await res.json()) as { success: boolean; error?: string };

      if (res.ok && body.success) {
        window.location.assign(next);
        return;
      }
      setError(body.error || 'Login failed');
    } catch {
      setError('Login failed — please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="card w-full max-w-sm p-8"
      style={{ borderWidth: '2px', borderColor: 'var(--border-primary)' }}
    >
      <div
        className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl shadow-lg"
        style={{ background: 'var(--accent-primary)' }}
      >
        <BookMarked className="h-7 w-7" style={{ color: 'var(--text-inverse)' }} />
      </div>
      <h2 className="mb-1 text-center font-bold text-2xl" style={{ color: 'var(--text-primary)' }}>
        Log in
      </h2>
      <p className="mb-6 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
        Editing and generation require a login.
      </p>

      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        placeholder="Password"
        autoComplete="current-password"
        className="input mb-4 w-full"
        style={{ color: 'var(--text-primary)' }}
      />

      {error && (
        <p className="mb-4 text-center font-medium text-sm" style={{ color: '#dc2626' }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting || !password}
        className="btn btn-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <LogIn className="h-4 w-4" />
        )}
        Log in
      </button>
    </form>
  );
};
