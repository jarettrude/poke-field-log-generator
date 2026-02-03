import React, { useState, useRef } from 'react';
import {
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Trash2,
  Download,
  Upload,
  FileText,
  Mic,
} from 'lucide-react';
import { StoredSummary, StoredAudioLog } from '../services/storageService';
import { formatPokemonId } from '../utils/pokemonUtils';
import { pcmToWav } from '../services/audioUtils';

interface LibraryViewProps {
  summaries: StoredSummary[];
  audioLogs: StoredAudioLog[];
  onRefresh: () => void;
  onDelete: (id: number) => void;
  onRegenerate: (id: number) => void;
  onDeleteAudio: (id: number) => void;
  onRegenerateAudio: (id: number) => void;
  onExport: () => void;
  onImport: (json: string) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  summaries,
  audioLogs,
  onRefresh,
  onDelete,
  onRegenerate,
  onDeleteAudio,
  onRegenerateAudio,
  onExport,
  onImport,
}) => {
  const [activeTab, setActiveTab] = useState<'summaries' | 'audio'>('summaries');
  const [filter, setFilter] = useState<number | 'all'>('all');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generations = [...new Set([...summaries.map(s => s.generationId), ...audioLogs.map(a => a.generationId)])].sort();

  const filteredSummaries =
    filter === 'all' ? summaries : summaries.filter(s => s.generationId === filter);

  const filteredAudioLogs =
    filter === 'all' ? audioLogs : audioLogs.filter(a => a.generationId === filter);

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const text = await file.text();
      onImport(text);
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-8">
        <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1">
          <button
            onClick={() => setActiveTab('summaries')}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'summaries'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <FileText className="h-4 w-4" />
            Summaries
          </button>
          <button
            onClick={() => setActiveTab('audio')}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'audio'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <Mic className="h-4 w-4" />
            Audio Logs
          </button>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-800">
              {activeTab === 'summaries' ? 'Summary Library' : 'Audio Library'}
            </h2>
            <p className="text-sm text-slate-500">
              {activeTab === 'summaries'
                ? `${summaries.length} summaries saved`
                : `${audioLogs.length} audio logs saved`}
            </p>
          </div>
          <div className="flex gap-3">
            <select
              value={filter}
              onChange={e => setFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="h-10 rounded-lg bg-slate-100 px-4 text-sm font-medium"
            >
              <option value="all">All Generations</option>
              {generations.map(g => (
                <option key={g} value={g}>
                  Generation {g}
                </option>
              ))}
            </select>
            <button
              onClick={onExport}
              className="flex h-10 items-center justify-center rounded-lg bg-slate-100 px-4 text-sm font-medium hover:bg-slate-200"
              title="Export JSON"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={handleImportClick}
              className="flex h-10 items-center justify-center rounded-lg bg-slate-100 px-4 text-sm font-medium hover:bg-slate-200"
              title="Import JSON"
            >
              <Upload className="h-4 w-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={onRefresh}
              className="flex h-10 items-center justify-center rounded-lg bg-slate-800 px-4 text-sm font-medium text-white hover:bg-slate-700"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'summaries' ? (
        filteredSummaries.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
            <p className="text-lg text-slate-400">No summaries saved yet.</p>
            <p className="mt-2 text-sm text-slate-300">Generate some summaries to see them here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSummaries
              .sort((a, b) => a.id - b.id)
              .map(summary => {
                const isExpanded = expandedIds.has(summary.id);
                return (
                  <div
                    key={summary.id}
                    className="rounded-xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md"
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-slate-400">
                          #{formatPokemonId(summary.id)}
                        </span>
                        <h3 className="font-bold text-slate-800 capitalize">{summary.name}</h3>
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-400">
                          {summary.region}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => onRegenerate(summary.id)}
                          className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700"
                        >
                          <RefreshCw className="h-3 w-3" /> Regenerate
                        </button>
                        <button
                          onClick={() => onDelete(summary.id)}
                          className="flex items-center gap-1 text-xs font-medium text-rose-400 hover:text-rose-600"
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </button>
                      </div>
                    </div>
                    <p
                      className={`cursor-pointer text-sm leading-relaxed text-slate-600 ${isExpanded ? '' : 'line-clamp-3'}`}
                      onClick={() => toggleExpand(summary.id)}
                    >
                      {summary.summary}
                    </p>
                    <button
                      onClick={() => toggleExpand(summary.id)}
                      className="mt-2 flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-3 w-3" /> Show less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3 w-3" /> Read full summary
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
          </div>
        )
      ) : filteredAudioLogs.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
          <p className="text-lg text-slate-400">No audio logs saved yet.</p>
          <p className="mt-2 text-sm text-slate-300">Generate some audio logs to see them here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAudioLogs
            .sort((a, b) => a.id - b.id)
            .map(audioLog => (
              <div
                key={audioLog.id}
                className="rounded-xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-slate-400">
                      #{formatPokemonId(audioLog.id)}
                    </span>
                    <h3 className="font-bold text-slate-800 capitalize">{audioLog.name}</h3>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-400">
                      {audioLog.region}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onRegenerateAudio(audioLog.id)}
                      className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700"
                    >
                      <RefreshCw className="h-3 w-3" /> Regenerate
                    </button>
                    <button
                      onClick={() => onDeleteAudio(audioLog.id)}
                      className="flex items-center gap-1 text-xs font-medium text-rose-400 hover:text-rose-600"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="rounded bg-slate-100 px-2 py-1">Voice: {audioLog.voice}</span>
                    <span className="rounded bg-slate-100 px-2 py-1">
                      {audioLog.audioFormat} @ {audioLog.sampleRate}Hz
                    </span>
                  </div>
                  <audio
                    controls
                    className="w-full"
                    src={pcmToWav(audioLog.audioBase64, audioLog.sampleRate)}
                  />
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};
