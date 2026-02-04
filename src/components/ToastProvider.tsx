'use client';

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Info, TriangleAlert, XCircle, X } from 'lucide-react';

type ToastVariant = 'success' | 'info' | 'warning' | 'error';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (toast: Omit<Toast, 'id'> & { durationMs?: number }) => void;
  dismissToast: (id: string) => void;
  clearToasts: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const iconForVariant = (variant: ToastVariant) => {
  if (variant === 'success') return CheckCircle2;
  if (variant === 'warning') return TriangleAlert;
  if (variant === 'error') return XCircle;
  return Info;
};

const stylesForVariant = (variant: ToastVariant) => {
  switch (variant) {
    case 'success':
      return {
        container: 'border-emerald-200 bg-emerald-50',
        icon: 'text-emerald-700',
        title: 'text-emerald-900',
        desc: 'text-emerald-800/80',
        close: 'text-emerald-800/70 hover:text-emerald-900',
      };
    case 'warning':
      return {
        container: 'border-amber-200 bg-amber-50',
        icon: 'text-amber-700',
        title: 'text-amber-900',
        desc: 'text-amber-800/80',
        close: 'text-amber-800/70 hover:text-amber-900',
      };
    case 'error':
      return {
        container: 'border-rose-200 bg-rose-50',
        icon: 'text-rose-700',
        title: 'text-rose-900',
        desc: 'text-rose-800/80',
        close: 'text-rose-800/70 hover:text-rose-900',
      };
    case 'info':
    default:
      return {
        container: 'border-slate-200 bg-white',
        icon: 'text-slate-700',
        title: 'text-slate-900',
        desc: 'text-slate-600',
        close: 'text-slate-500 hover:text-slate-700',
      };
  }
};

const genId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const clearToasts = useCallback(() => {
    for (const t of toasts) {
      const timer = timers.current.get(t.id);
      if (timer) window.clearTimeout(timer);
    }
    timers.current.clear();
    setToasts([]);
  }, [toasts]);

  const showToast = useCallback(
    (toast: Omit<Toast, 'id'> & { durationMs?: number }) => {
      const id = genId();
      const durationMs = toast.durationMs ?? 4000;
      setToasts(prev =>
        [
          { id, title: toast.title, description: toast.description, variant: toast.variant },
          ...prev,
        ].slice(0, 4)
      );

      const timer = window.setTimeout(() => {
        dismissToast(id);
      }, durationMs);
      timers.current.set(id, timer);
    },
    [dismissToast]
  );

  const value = useMemo<ToastContextValue>(
    () => ({ toasts, showToast, dismissToast, clearToasts }),
    [toasts, showToast, dismissToast, clearToasts]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[60] flex w-[min(420px,calc(100vw-2rem))] flex-col gap-3">
        {toasts.map(t => {
          const Icon = iconForVariant(t.variant);
          const s = stylesForVariant(t.variant);
          return (
            <div
              key={t.id}
              className={`rounded-xl border p-4 shadow-sm backdrop-blur ${s.container}`}
              role="status"
              aria-live="polite"
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 ${s.icon}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-semibold ${s.title}`}>{t.title}</div>
                  {t.description && (
                    <div className={`mt-0.5 text-sm ${s.desc}`}>{t.description}</div>
                  )}
                </div>
                <button
                  onClick={() => dismissToast(t.id)}
                  className={`-mt-1 -mr-1 rounded-md p-1 transition-colors ${s.close}`}
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
};
