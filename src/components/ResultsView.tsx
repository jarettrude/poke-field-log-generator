import { AlertTriangle, ArrowLeft, CheckCircle, Trash2 } from 'lucide-react';
import Image from 'next/image';
import type React from 'react';
import { POKEBALL_IMAGE } from '../constants';
import { mp3ToUrl, transcriptToCaptionUrl } from '../services/audioUtils';
import type { ProcessedPokemon } from '../types';
import { formatPokemonId } from '../utils/pokemonUtils';

interface ResultsViewProps {
  results: ProcessedPokemon[];
  onClear: () => void;
  onBack: () => void;
  errorMessage?: string | null;
}

export const ResultsView: React.FC<ResultsViewProps> = ({
  results,
  onClear,
  onBack,
  errorMessage,
}) => {
  const hasError = !!errorMessage;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Error Banner */}
      {hasError && (
        <div
          className="mb-6 rounded-xl border-2 p-5"
          style={{ background: '#fef2f2', borderColor: '#fca5a5' }}
        >
          <div className="flex gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              style={{ background: '#fee2e2' }}
            >
              <AlertTriangle className="h-5 w-5" style={{ color: '#dc2626' }} />
            </div>
            <div>
              <h3 className="font-bold text-sm" style={{ color: '#991b1b' }}>
                Generation Stopped
              </h3>
              <p className="mt-1 text-sm leading-relaxed" style={{ color: '#7f1d1d' }}>
                {errorMessage}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div
        className="mb-8 rounded-xl border-2 p-6"
        style={{
          background: 'var(--surface-card)',
          borderColor: hasError ? '#f59e0b' : 'var(--accent-secondary)',
        }}
      >
        <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: hasError ? '#f59e0b' : 'var(--accent-secondary)' }}
            >
              {hasError ? (
                <AlertTriangle className="h-6 w-6" style={{ color: 'var(--text-inverse)' }} />
              ) : (
                <CheckCircle className="h-6 w-6" style={{ color: 'var(--text-inverse)' }} />
              )}
            </div>
            <div>
              <h2 className="font-bold text-xl" style={{ color: 'var(--text-primary)' }}>
                {hasError ? 'Partial Results' : 'Generation Complete'}
              </h2>
              <p className="font-medium text-sm" style={{ color: 'var(--text-secondary)' }}>
                {hasError
                  ? `${results.length} field ${results.length === 1 ? 'log' : 'logs'} generated before the error`
                  : `${results.length} field ${results.length === 1 ? 'log' : 'logs'} generated successfully`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <button type="button" onClick={onBack} className="btn btn-secondary">
              <ArrowLeft className="h-4 w-4" />
              New Mission
            </button>
            <button type="button" onClick={onClear} className="btn btn-outline">
              <Trash2 className="h-4 w-4" />
              Clear Results
            </button>
          </div>
        </div>
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {results.map(r => (
          <div key={r.id} className="card transition-all hover:shadow-lg">
            <div className="mb-4 flex items-center gap-3">
              <Image
                src={r.pngData || r.svgData || POKEBALL_IMAGE}
                alt={r.displayName || r.name}
                width={48}
                height={48}
                className="h-12 w-12 object-contain"
                unoptimized={!!(r.pngData || r.svgData)}
              />
              <div>
                <span className="font-semibold text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  #{formatPokemonId(r.id)}
                </span>
                <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>
                  {r.displayName || r.name}
                </h3>
              </div>
            </div>
            <p
              className="mb-4 line-clamp-3 text-sm leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              {r.summary}
            </p>
            {r.audioData && (
              <audio
                controls
                className="h-10 w-full rounded-lg"
                src={mp3ToUrl(r.audioData)}
                style={{ accentColor: 'var(--accent-primary)' }}
              >
                <track
                  kind="captions"
                  src={transcriptToCaptionUrl(r.summary)}
                  srcLang="en"
                  label="Transcript"
                  default
                />
              </audio>
            )}
          </div>
        ))}
      </div>

      {/* Empty State */}
      {results.length === 0 && (
        <div
          className="rounded-xl border-2 border-dashed p-12 text-center"
          style={{ borderColor: 'var(--border-secondary)' }}
        >
          <p className="font-medium text-lg" style={{ color: 'var(--text-tertiary)' }}>
            No results to display
          </p>
          <button type="button" onClick={onBack} className="btn btn-primary mt-4">
            <ArrowLeft className="h-4 w-4" />
            Start a New Mission
          </button>
        </div>
      )}
    </div>
  );
};
