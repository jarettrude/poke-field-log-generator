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
  Search,
} from 'lucide-react';
import { StoredSummary, StoredAudioLog } from '../services/storageService';
import { formatPokemonId } from '../utils/pokemonUtils';
import { mp3ToUrl } from '../services/audioUtils';

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
  const [regionFilter, setRegionFilter] = useState<string | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [savedFilter, setSavedFilter] = useState<'all' | 'withAudio' | 'missingAudio'>('all');
  const [sortBy, setSortBy] = useState<'id' | 'name' | 'updatedAt'>('updatedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generations = [
    ...new Set([...summaries.map(s => s.generationId), ...audioLogs.map(a => a.generationId)]),
  ].sort();

  const regions = [...new Set([...summaries.map(s => s.region), ...audioLogs.map(a => a.region)])]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  const audioIds = new Set(audioLogs.map(a => a.id));

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredSummaries = summaries
    .filter(s => (filter === 'all' ? true : s.generationId === filter))
    .filter(s => (regionFilter === 'all' ? true : s.region === regionFilter))
    .filter(s => {
      if (savedFilter === 'all') return true;
      const hasAudio = audioIds.has(s.id);
      return savedFilter === 'withAudio' ? hasAudio : !hasAudio;
    })
    .filter(s => {
      if (!normalizedQuery) return true;
      return (
        s.name.toLowerCase().includes(normalizedQuery) ||
        s.id.toString().includes(normalizedQuery) ||
        s.summary.toLowerCase().includes(normalizedQuery)
      );
    });

  const filteredAudioLogs = audioLogs
    .filter(a => (filter === 'all' ? true : a.generationId === filter))
    .filter(a => (regionFilter === 'all' ? true : a.region === regionFilter))
    .filter(a => {
      if (!normalizedQuery) return true;
      return (
        a.name.toLowerCase().includes(normalizedQuery) ||
        a.id.toString().includes(normalizedQuery) ||
        a.voice.toLowerCase().includes(normalizedQuery)
      );
    });

  const compare = (
    a: { id: number; name: string; updatedAt: string },
    b: { id: number; name: string; updatedAt: string }
  ) => {
    let v = 0;
    if (sortBy === 'id') v = a.id - b.id;
    else if (sortBy === 'name') v = a.name.localeCompare(b.name);
    else v = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    return sortDir === 'asc' ? v : -v;
  };

  const sortedSummaries = [...filteredSummaries].sort(compare);
  const sortedAudioLogs = [...filteredAudioLogs].sort(compare);

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
        <div className="mb-4 flex gap-1 rounded-lg bg-amber-50/70 p-1">
          <button
            onClick={() => setActiveTab('summaries')}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'summaries'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <FileText className="h-4 w-4" />
            Summaries
          </button>
          <button
            onClick={() => setActiveTab('audio')}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'audio'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Mic className="h-4 w-4" />
            Audio Logs
          </button>
        </div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
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
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <div className="flex h-10 items-center gap-2 rounded-lg border border-amber-100 bg-white px-3 text-sm">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === 'summaries'
                    ? 'Search name, ID, or text...'
                    : 'Search name, ID, or voice...'
                }
                className="w-60 bg-transparent font-medium text-slate-700 outline-none placeholder:text-slate-400"
              />
            </div>

            <select
              value={filter}
              onChange={e => setFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="h-10 rounded-lg border border-amber-100 bg-white px-3 text-sm font-medium text-slate-800"
            >
              <option value="all">All Generations</option>
              {generations.map(g => (
                <option key={g} value={g}>
                  Generation {g}
                </option>
              ))}
            </select>

            <select
              value={regionFilter}
              onChange={e => setRegionFilter(e.target.value === 'all' ? 'all' : e.target.value)}
              className="h-10 rounded-lg border border-amber-100 bg-white px-3 text-sm font-medium text-slate-800"
            >
              <option value="all">All Regions</option>
              {regions.map(r => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            {activeTab === 'summaries' && (
              <div className="flex gap-1 rounded-lg bg-amber-50/70 p-1">
                <button
                  onClick={() => setSavedFilter('all')}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    savedFilter === 'all'
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setSavedFilter('withAudio')}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    savedFilter === 'withAudio'
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  With audio
                </button>
                <button
                  onClick={() => setSavedFilter('missingAudio')}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    savedFilter === 'missingAudio'
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  Missing audio
                </button>
              </div>
            )}

            <select
              value={`${sortBy}:${sortDir}`}
              onChange={e => {
                const [nextBy, nextDir] = e.target.value.split(':') as [
                  'id' | 'name' | 'updatedAt',
                  'asc' | 'desc',
                ];
                setSortBy(nextBy);
                setSortDir(nextDir);
              }}
              className="h-10 rounded-lg border border-amber-100 bg-white px-3 text-sm font-medium text-slate-800"
            >
              <option value="updatedAt:desc">Newest</option>
              <option value="updatedAt:asc">Oldest</option>
              <option value="id:asc">Dex ID (A-Z)</option>
              <option value="id:desc">Dex ID (Z-A)</option>
              <option value="name:asc">Name (A-Z)</option>
              <option value="name:desc">Name (Z-A)</option>
            </select>

            <button
              onClick={onExport}
              className="flex h-10 items-center justify-center rounded-lg border border-amber-100 bg-white px-4 text-sm font-medium text-slate-800 hover:bg-amber-50"
              title="Export JSON"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={handleImportClick}
              className="flex h-10 items-center justify-center rounded-lg border border-amber-100 bg-white px-4 text-sm font-medium text-slate-800 hover:bg-amber-50"
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
              className="bg-pokeball-600 hover:bg-pokeball-700 flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium text-white"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'summaries' ? (
        sortedSummaries.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
            <p className="text-lg text-slate-500">No matches found.</p>
            <p className="mt-2 text-sm text-slate-400">
              Try adjusting your search or filters, or generate a new batch.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedSummaries.map(summary => {
              const isExpanded = expandedIds.has(summary.id);
              const hasAudio = audioIds.has(summary.id);
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
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                        {summary.region}
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${
                          hasAudio ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}
                        title={hasAudio ? 'Audio saved' : 'No audio yet'}
                      >
                        {hasAudio ? 'Audio ready' : 'Text only'}
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
          <p className="text-lg text-slate-500">No matches found.</p>
          <p className="mt-2 text-sm text-slate-400">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedAudioLogs.map(audioLog => (
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
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
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
                    {audioLog.audioFormat} @ {audioLog.bitrate}kbps
                  </span>
                </div>
                <audio controls className="w-full" src={mp3ToUrl(audioLog.audioBase64)} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
