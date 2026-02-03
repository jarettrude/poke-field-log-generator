import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { CooldownState } from '../types';
import { POKEBALL_IMAGE, getRandomFlavorText } from '../constants';

interface ProcessingOverlayProps {
  progress: { current: number; total: number; message: string; stage: 'summary' | 'audio' };
  cooldown: CooldownState | null;
  currentSummary: string | null;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}

export const ProcessingOverlay: React.FC<ProcessingOverlayProps> = ({
  progress,
  cooldown,
  currentSummary,
  isPaused,
  onPause,
  onResume,
  onCancel,
}) => {
  const [flavorText, setFlavorText] = useState(getRandomFlavorText());

  useEffect(() => {
    const interval = setInterval(() => {
      setFlavorText(getRandomFlavorText());
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (ms: number) => {
    const seconds = Math.ceil(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-auto bg-white/95 p-6 backdrop-blur-md">
      <div className="w-full max-w-2xl space-y-8 text-center">
        {/* Animated Pokeball */}
        <div className="relative mx-auto inline-flex h-32 w-32 items-center justify-center">
          <div
            className={`absolute inset-0 rounded-full border-4 border-slate-100 border-t-slate-600 ${!isPaused && !cooldown?.active ? 'animate-spin' : 'opacity-30'}`}
          />
          <Image
            src={POKEBALL_IMAGE}
            width={48}
            height={48}
            className="h-12 w-12 object-contain"
            alt="Processing"
          />
        </div>

        {/* Status */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5">
            <span
              className={`h-1.5 w-1.5 rounded-full ${isPaused ? 'bg-amber-500' : 'animate-pulse bg-emerald-500'}`}
            />
            <span className="text-xs font-medium text-slate-600">
              {progress.stage === 'summary' ? 'Generating Summaries' : 'Synthesizing Audio'}
            </span>
          </div>

          <h2 className="min-h-8 text-xl font-medium text-slate-700">
            {isPaused ? 'Paused' : cooldown?.active ? flavorText : progress.message}
          </h2>

          {/* Cooldown Timer */}
          {cooldown?.active && (
            <div className="mx-auto max-w-md rounded-lg border border-amber-200 bg-amber-50 p-5 text-left">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-amber-600">Cooldown</span>
                <span className="text-lg font-semibold text-amber-700">
                  {formatTime(cooldown.remainingMs)}
                </span>
              </div>
              <p className="text-sm text-amber-600/80">{flavorText}</p>
            </div>
          )}

          {/* Current Summary Preview */}
          {currentSummary && !cooldown?.active && (
            <div className="mx-auto max-h-40 max-w-md overflow-y-auto rounded-lg bg-slate-50 p-4 text-left">
              <p className="text-sm leading-relaxed text-slate-500">{currentSummary}</p>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mx-auto w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-slate-700 transition-all duration-500"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>Progress</span>
            <span className="font-medium text-slate-700">
              {progress.current} / {progress.total}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-4">
          <button
            onClick={isPaused ? onResume : onPause}
            className="rounded-lg bg-slate-800 px-6 py-2.5 font-medium text-white transition-colors hover:bg-slate-700"
          >
            {isPaused ? 'Resume' : 'Pause'}
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg bg-slate-100 px-6 py-2.5 font-medium text-slate-600 transition-colors hover:bg-slate-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
