import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { CooldownState } from '../types';
import { POKEBALL_IMAGE, getRandomFlavorText } from '../constants';

interface ProcessingOverlayProps {
  progress: {
    current: number;
    total: number;
    message: string;
    stage: 'summary' | 'audio';
    currentPokemonId?: number;
    currentPokemonName?: string;
    currentPokemonImage?: string;
  };
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

  // Show pokeball during cooldown or when no pokemon image is available
  const showPokeball = cooldown?.active || !progress.currentPokemonImage;
  const currentImage = showPokeball ? POKEBALL_IMAGE : progress.currentPokemonImage;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-auto p-6 backdrop-blur-md"
      style={{ background: 'var(--surface-overlay)' }}
    >
      <div className="w-full max-w-2xl space-y-8 text-center">
        {/* Animated Pokemon/Pokeball Image */}
        <div className="relative mx-auto inline-flex h-36 w-36 items-center justify-center">
          <div
            className={`absolute inset-0 rounded-full border-4 shadow-lg ${!isPaused && !cooldown?.active ? 'animate-spin' : 'opacity-30'}`}
            style={{
              borderColor: 'var(--border-primary)',
              borderTopColor: 'var(--accent-primary)',
            }}
          />
          <Image
            src={currentImage || POKEBALL_IMAGE}
            width={showPokeball ? 56 : 80}
            height={showPokeball ? 56 : 80}
            className={`object-contain transition-all duration-300 ${showPokeball ? 'h-14 w-14' : 'h-20 w-20'}`}
            alt={progress.currentPokemonName || 'Processing'}
            unoptimized={!showPokeball}
          />
        </div>

        {/* Current Pokemon Name */}
        {progress.currentPokemonName && !cooldown?.active && (
          <div className="text-lg font-bold capitalize" style={{ color: 'var(--text-primary)' }}>
            #{progress.currentPokemonId?.toString().padStart(3, '0')} {progress.currentPokemonName}
          </div>
        )}

        {/* Status */}
        <div className="space-y-4">
          <div
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 shadow-sm"
            style={{ background: 'var(--bg-secondary)' }}
          >
            <span
              className={`h-2 w-2 rounded-full ${isPaused ? '' : 'animate-pulse'}`}
              style={{ background: isPaused ? '#d97706' : 'var(--accent-secondary)' }}
            />
            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              {progress.stage === 'summary' ? 'Generating Summaries' : 'Synthesizing Audio'}
            </span>
          </div>

          <h2 className="min-h-8 text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {isPaused ? 'Paused' : cooldown?.active ? 'Cooling down…' : progress.message}
          </h2>

          {/* Cooldown Timer */}
          {cooldown?.active && (
            <div
              className="card-elevated mx-auto max-w-md text-left"
              style={{ borderColor: '#d97706' }}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-bold" style={{ color: '#d97706' }}>
                  Cooldown
                </span>
                <span className="text-2xl font-bold" style={{ color: '#b45309' }}>
                  {formatTime(cooldown.remainingMs)}
                </span>
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                {flavorText}
              </p>
            </div>
          )}

          {/* Current Summary Preview */}
          {currentSummary && !cooldown?.active && (
            <div className="card mx-auto max-h-40 max-w-md overflow-y-auto text-left">
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {currentSummary}
              </p>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="card-elevated mx-auto w-full max-w-sm">
          <div
            className="mb-4 h-3 overflow-hidden rounded-full"
            style={{ background: 'var(--bg-secondary)' }}
          >
            <div
              className="h-full transition-all duration-500"
              style={{
                background:
                  'linear-gradient(to right, var(--accent-secondary), var(--accent-primary))',
                width: `${(progress.current / progress.total) * 100}%`,
              }}
            />
          </div>
          <div className="flex justify-between text-sm font-semibold">
            <span style={{ color: 'var(--text-secondary)' }}>Progress</span>
            <span style={{ color: 'var(--text-primary)' }}>
              {progress.current} / {progress.total}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-4">
          <button onClick={isPaused ? onResume : onPause} className="btn btn-secondary">
            {isPaused ? 'Resume' : 'Pause'}
          </button>
          <button onClick={onCancel} className="btn btn-outline">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
