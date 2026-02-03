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
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h2 className="mb-3 text-center text-2xl font-semibold text-slate-800">
        Select Pipeline Mode
      </h2>
      <p className="mx-auto mb-10 max-w-lg text-center text-sm leading-relaxed text-slate-500">
        Generate field researcher logs with AI-powered text and speech synthesis.
      </p>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <button
          onClick={() => onSelectMode(WorkflowMode.FULL)}
          onMouseEnter={() => setHoveredMode(WorkflowMode.FULL)}
          onMouseLeave={() => setHoveredMode(null)}
          className={`group rounded-xl border bg-white p-6 text-left transition-all hover:shadow-lg ${
            hoveredMode === WorkflowMode.FULL ? 'border-slate-300 shadow-md' : 'border-slate-200'
          }`}
        >
          <div
            className={`mb-5 flex h-11 w-11 items-center justify-center rounded-lg transition-colors ${
              hoveredMode === WorkflowMode.FULL
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            <Sparkles className="h-5 w-5" />
          </div>
          <h3 className="mb-1.5 text-lg font-semibold text-slate-800">Full Pipeline</h3>
          <p className="text-sm leading-relaxed text-slate-500">
            Generate summaries and audio together. Best for small batches.
          </p>
        </button>

        <button
          onClick={() => onSelectMode(WorkflowMode.SUMMARY_ONLY)}
          onMouseEnter={() => setHoveredMode(WorkflowMode.SUMMARY_ONLY)}
          onMouseLeave={() => setHoveredMode(null)}
          className={`group rounded-xl border bg-white p-6 text-left transition-all hover:shadow-lg ${
            hoveredMode === WorkflowMode.SUMMARY_ONLY
              ? 'border-slate-300 shadow-md'
              : 'border-slate-200'
          }`}
        >
          <div
            className={`mb-5 flex h-11 w-11 items-center justify-center rounded-lg transition-colors ${
              hoveredMode === WorkflowMode.SUMMARY_ONLY
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-600'
            }`}
          >
            <FileText className="h-5 w-5" />
          </div>
          <h3 className="mb-1.5 text-lg font-semibold text-slate-800">Text Only</h3>
          <p className="text-sm leading-relaxed text-slate-500">
            Generate and save summaries. Review before synthesizing audio.
          </p>
        </button>

        <button
          onClick={() => onSelectMode(WorkflowMode.AUDIO_ONLY)}
          onMouseEnter={() => setHoveredMode(WorkflowMode.AUDIO_ONLY)}
          onMouseLeave={() => setHoveredMode(null)}
          className={`group relative rounded-xl border bg-white p-6 text-left transition-all hover:shadow-lg ${
            hoveredMode === WorkflowMode.AUDIO_ONLY
              ? 'border-slate-300 shadow-md'
              : 'border-slate-200'
          }`}
        >
          <div
            className={`mb-5 flex h-11 w-11 items-center justify-center rounded-lg transition-colors ${
              hoveredMode === WorkflowMode.AUDIO_ONLY
                ? 'bg-amber-500 text-white'
                : 'bg-amber-50 text-amber-600'
            }`}
          >
            <Mic className="h-5 w-5" />
          </div>
          <h3 className="mb-1.5 text-lg font-semibold text-slate-800">Audio Only</h3>
          <p className="text-sm leading-relaxed text-slate-500">
            Synthesize speech from saved summaries in your library.
          </p>
          {summaryCount > 0 && (
            <span className="absolute top-4 right-4 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {summaryCount} ready
            </span>
          )}
          {audioCount > 0 && (
            <span className="absolute top-10 right-4 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-600">
              {audioCount} saved
            </span>
          )}
        </button>
      </div>
    </div>
  );
};
