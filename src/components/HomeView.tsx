import React, { useState } from 'react';
import { Sparkles, FileText, Mic } from 'lucide-react';
import { WorkflowMode } from '../types';

interface HomeViewProps {
  onSelectMode: (mode: WorkflowMode) => void;
  summaryCount: number;
  audioCount: number;
}

export const HomeView: React.FC<HomeViewProps> = ({ onSelectMode, summaryCount, audioCount }) => {
  const [hoveredMode, setHoveredMode] = useState<WorkflowMode | null>(null);

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <h2 className="mb-3 text-center text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>
        Select Pipeline Mode
      </h2>
      <p
        className="mx-auto mb-12 max-w-2xl text-center text-base leading-relaxed"
        style={{ color: 'var(--text-secondary)' }}
      >
        Generate field researcher logs with AI-powered text and speech synthesis.
      </p>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <button
          onClick={() => onSelectMode(WorkflowMode.FULL)}
          onMouseEnter={() => setHoveredMode(WorkflowMode.FULL)}
          onMouseLeave={() => setHoveredMode(null)}
          className="card group p-8 text-left"
          style={{
            borderWidth: '3px',
            borderColor:
              hoveredMode === WorkflowMode.FULL ? 'var(--accent-primary)' : 'var(--border-primary)',
          }}
        >
          <div
            className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl shadow-lg transition-colors"
            style={{
              background:
                hoveredMode === WorkflowMode.FULL ? 'var(--accent-primary)' : 'var(--bg-secondary)',
              color:
                hoveredMode === WorkflowMode.FULL ? 'var(--text-inverse)' : 'var(--accent-primary)',
            }}
          >
            <Sparkles className="h-7 w-7" />
          </div>
          <h3 className="mb-2 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Full Pipeline
          </h3>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Generate summaries and audio together. Best for small batches.
          </p>
        </button>

        <button
          onClick={() => onSelectMode(WorkflowMode.SUMMARY_ONLY)}
          onMouseEnter={() => setHoveredMode(WorkflowMode.SUMMARY_ONLY)}
          onMouseLeave={() => setHoveredMode(null)}
          className="card group p-8 text-left"
          style={{
            borderWidth: '3px',
            borderColor:
              hoveredMode === WorkflowMode.SUMMARY_ONLY
                ? 'var(--accent-secondary)'
                : 'var(--border-primary)',
          }}
        >
          <div
            className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl shadow-lg transition-colors"
            style={{
              background:
                hoveredMode === WorkflowMode.SUMMARY_ONLY
                  ? 'var(--accent-secondary)'
                  : 'var(--bg-secondary)',
              color:
                hoveredMode === WorkflowMode.SUMMARY_ONLY
                  ? 'var(--text-inverse)'
                  : 'var(--accent-secondary)',
            }}
          >
            <FileText className="h-7 w-7" />
          </div>
          <h3 className="mb-2 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Text Only
          </h3>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Generate and save summaries. Review before synthesizing audio.
          </p>
        </button>

        <button
          onClick={() => onSelectMode(WorkflowMode.AUDIO_ONLY)}
          onMouseEnter={() => setHoveredMode(WorkflowMode.AUDIO_ONLY)}
          onMouseLeave={() => setHoveredMode(null)}
          className="card group relative p-8 text-left"
          style={{
            borderWidth: '3px',
            borderColor:
              hoveredMode === WorkflowMode.AUDIO_ONLY ? '#d97706' : 'var(--border-primary)',
          }}
        >
          <div
            className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl shadow-lg transition-colors"
            style={{
              background:
                hoveredMode === WorkflowMode.AUDIO_ONLY ? '#d97706' : 'var(--bg-secondary)',
              color: hoveredMode === WorkflowMode.AUDIO_ONLY ? 'var(--text-inverse)' : '#d97706',
            }}
          >
            <Mic className="h-7 w-7" />
          </div>
          <h3 className="mb-2 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Audio Only
          </h3>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Synthesize speech from saved summaries in your library.
          </p>
          {summaryCount > 0 && (
            <span className="badge badge-secondary absolute top-6 right-6 shadow-md">
              {summaryCount} ready
            </span>
          )}
          {audioCount > 0 && (
            <span className="badge badge-neutral absolute top-16 right-6 shadow-md">
              {audioCount} saved
            </span>
          )}
        </button>
      </div>
    </div>
  );
};
