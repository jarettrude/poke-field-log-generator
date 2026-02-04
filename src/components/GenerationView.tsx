import React, { useMemo } from 'react';
import { Generation, PokemonBaseInfo, WorkflowMode } from '../types';
import { StoredSummary } from '../services/storageService';
import { VOICE_OPTIONS } from '../constants';
import { formatPokemonId } from '../utils/pokemonUtils';

interface GenerationViewProps {
  mode: WorkflowMode;
  generations: Generation[];
  selectedGenId: number;
  onGenChange: (genId: number) => void;
  pokemonList: PokemonBaseInfo[];
  selectedIds: Set<number>;
  onToggleSelection: (id: number) => void;
  rangeStart: number;
  rangeEnd: number;
  onRangeChange: (start: number, end: number) => void;
  selectedVoice: string;
  onVoiceChange: (voice: string) => void;
  onStartProcess: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isLoading: boolean;
  savedSummaries: StoredSummary[];
}

export const GenerationView: React.FC<GenerationViewProps> = ({
  mode,
  generations,
  selectedGenId,
  onGenChange,
  pokemonList,
  selectedIds,
  onToggleSelection,
  rangeStart,
  rangeEnd,
  onRangeChange,
  selectedVoice,
  onVoiceChange,
  onStartProcess,
  searchQuery,
  onSearchChange,
  isLoading,
  savedSummaries,
}) => {
  const filteredPokemon = useMemo(() => {
    let list = pokemonList;
    if (searchQuery) {
      list = list.filter(
        p =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.id.toString().includes(searchQuery)
      );
    }
    return list;
  }, [pokemonList, searchQuery]);

  const savedIds = new Set(savedSummaries.map(s => s.id));

  const getModeLabel = () => {
    switch (mode) {
      case WorkflowMode.FULL:
        return 'Generate Full Logs';
      case WorkflowMode.SUMMARY_ONLY:
        return 'Generate Summaries';
      case WorkflowMode.AUDIO_ONLY:
        return 'Generate Audio';
    }
  };

  const getModeColor = () => {
    switch (mode) {
      case WorkflowMode.FULL:
        return 'bg-pokeball-600 hover:bg-pokeball-700';
      case WorkflowMode.SUMMARY_ONLY:
        return 'bg-emerald-600 hover:bg-emerald-700';
      case WorkflowMode.AUDIO_ONLY:
        return 'bg-amber-600 hover:bg-amber-700';
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-8 rounded-xl border border-amber-100/80 bg-white p-8 shadow-sm">
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
              Region Era
            </label>
            <select
              value={selectedGenId}
              onChange={e => onGenChange(Number(e.target.value))}
              className="focus:border-pokeball-300 focus:ring-pokeball-100 h-14 w-full rounded-lg border border-amber-100 bg-white px-4 font-medium text-slate-800 transition-colors outline-none hover:border-amber-200 focus:ring-1"
            >
              {generations.map(g => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {mode !== WorkflowMode.SUMMARY_ONLY && (
            <div className="space-y-2">
              <label className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
                Voice Profile
              </label>
              <select
                value={selectedVoice}
                onChange={e => onVoiceChange(e.target.value)}
                className="focus:border-pokeball-300 focus:ring-pokeball-100 h-14 w-full rounded-lg border border-amber-100 bg-white px-4 font-medium text-slate-800 transition-colors outline-none hover:border-amber-200 focus:ring-1"
              >
                {VOICE_OPTIONS.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
              Start ID
            </label>
            <input
              type="number"
              value={rangeStart}
              onChange={e => onRangeChange(parseInt(e.target.value) || 1, rangeEnd)}
              disabled={selectedIds.size > 0}
              className="h-14 w-full rounded-lg border border-amber-100 bg-white px-4 font-medium text-slate-700 disabled:opacity-50"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
              End ID
            </label>
            <input
              type="number"
              value={rangeEnd}
              onChange={e => onRangeChange(rangeStart, parseInt(e.target.value) || 1)}
              disabled={selectedIds.size > 0}
              className="h-14 w-full rounded-lg border border-amber-100 bg-white px-4 font-medium text-slate-700 disabled:opacity-50"
            />
          </div>
        </div>

        <div className="flex flex-col items-end gap-4 md:flex-row">
          <div className="flex-1 space-y-2">
            <label className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
              Search
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              className="focus:border-pokeball-300 focus:ring-pokeball-100 h-14 w-full rounded-lg border border-amber-100 bg-white px-5 font-medium outline-none focus:ring-1"
              placeholder="Find by name or ID..."
            />
          </div>

          <button
            onClick={onStartProcess}
            className={`h-14 rounded-lg px-8 font-semibold text-white shadow-sm transition-all hover:shadow ${getModeColor()}`}
          >
            {selectedIds.size > 0 ? `${getModeLabel()} (${selectedIds.size})` : getModeLabel()}
          </button>
        </div>

        {selectedIds.size > 0 && (
          <div className="mt-6 rounded-lg border border-rose-100 bg-rose-50/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-600">
                {selectedIds.size} selected
              </span>
              <button
                onClick={() => selectedIds.forEach(id => onToggleSelection(id))}
                className="text-xs font-medium text-rose-400 hover:text-rose-600"
              >
                Clear All
              </button>
            </div>
            <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto">
              {(Array.from(selectedIds) as number[])
                .sort((a, b) => a - b)
                .map(id => (
                  <span
                    key={id}
                    onClick={() => onToggleSelection(id)}
                    className="cursor-pointer rounded bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm hover:bg-rose-100 hover:text-rose-700"
                  >
                    #{id}
                  </span>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Pokemon Grid */}
      <div className="grid grid-cols-3 gap-2.5 md:grid-cols-5 lg:grid-cols-8">
        {isLoading
          ? Array.from({ length: 24 }).map((_, i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-lg border border-slate-100 bg-slate-50"
              />
            ))
          : filteredPokemon.map(p => {
              const isSelected = selectedIds.has(p.id);
              const hasSavedSummary = savedIds.has(p.id);
              return (
                <div
                  key={p.id}
                  onClick={() => onToggleSelection(p.id)}
                  className={`group relative cursor-pointer rounded-lg border bg-white p-3.5 transition-all ${
                    isSelected
                      ? 'border-rose-500 bg-rose-50/30 shadow-sm'
                      : 'border-slate-150 hover:border-slate-300 hover:shadow-md'
                  }`}
                >
                  {hasSavedSummary && (
                    <div
                      className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-emerald-500"
                      title="Summary saved"
                    />
                  )}
                  <span
                    className={`text-[9px] font-semibold tracking-wide ${isSelected ? 'text-rose-500' : 'text-slate-300'}`}
                  >
                    #{formatPokemonId(p.id)}
                  </span>
                  <h4
                    className={`mt-1 truncate text-xs font-medium capitalize ${isSelected ? 'text-slate-800' : 'text-slate-500'}`}
                  >
                    {p.name}
                  </h4>
                </div>
              );
            })}
      </div>
    </div>
  );
};
