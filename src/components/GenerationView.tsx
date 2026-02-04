import React, { useMemo } from 'react';
import { Volume2, FileText, Wand2, Mic } from 'lucide-react';
import { Generation, PokemonBaseInfo, WorkflowMode } from '../types';
import { StoredSummary, AudioLogMetadata } from '../services/storageService';
import { VOICE_OPTIONS } from '../constants';
import { formatPokemonId } from '../utils/pokemonUtils';

interface GenerationViewProps {
  mode: WorkflowMode;
  onModeChange?: (mode: WorkflowMode) => void;
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
  savedAudioLogs: AudioLogMetadata[];
}

export const GenerationView: React.FC<GenerationViewProps> = ({
  mode,
  onModeChange,
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
  savedAudioLogs,
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

  const savedSummaryIds = new Set(savedSummaries.map(s => s.id));
  const savedAudioIds = new Set(savedAudioLogs.map(a => a.id));

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

  const modeOptions = [
    { value: WorkflowMode.FULL, label: 'Full Logs', icon: Wand2, desc: 'Summary + Audio' },
    { value: WorkflowMode.SUMMARY_ONLY, label: 'Summaries', icon: FileText, desc: 'Text only' },
    { value: WorkflowMode.AUDIO_ONLY, label: 'Audio', icon: Mic, desc: 'From saved summaries' },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* Mode Selection */}
      {onModeChange && (
        <div className="mb-6 flex flex-wrap justify-center gap-3">
          {modeOptions.map(({ value, label, icon: Icon, desc }) => (
            <button
              key={value}
              onClick={() => onModeChange(value)}
              className="flex items-center gap-3 rounded-xl border-2 px-5 py-3 transition-all"
              style={{
                background: mode === value ? 'var(--accent-primary)' : 'var(--surface-card)',
                borderColor: mode === value ? 'var(--accent-primary)' : 'var(--border-primary)',
                color: mode === value ? 'var(--text-inverse)' : 'var(--text-primary)',
              }}
            >
              <Icon className="h-5 w-5" />
              <div className="text-left">
                <div className="font-semibold">{label}</div>
                <div className="text-xs opacity-75">{desc}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      <div
        className="mb-8 rounded-xl border-2 p-8 shadow-sm"
        style={{ background: 'var(--surface-card)', borderColor: 'var(--border-primary)' }}
      >
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <label
              className="text-xs font-semibold tracking-wide uppercase"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Region Era
            </label>
            <select
              value={selectedGenId}
              onChange={e => onGenChange(Number(e.target.value))}
              className="select h-14"
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
              <label
                className="text-xs font-semibold tracking-wide uppercase"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Voice Profile
              </label>
              <select
                value={selectedVoice}
                onChange={e => onVoiceChange(e.target.value)}
                className="select h-14"
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
            <label
              className="text-xs font-semibold tracking-wide uppercase"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Start ID
            </label>
            <input
              type="number"
              value={rangeStart}
              onChange={e => onRangeChange(parseInt(e.target.value) || 1, rangeEnd)}
              disabled={selectedIds.size > 0}
              className="input h-14 disabled:opacity-50"
            />
          </div>

          <div className="space-y-2">
            <label
              className="text-xs font-semibold tracking-wide uppercase"
              style={{ color: 'var(--text-tertiary)' }}
            >
              End ID
            </label>
            <input
              type="number"
              value={rangeEnd}
              onChange={e => onRangeChange(rangeStart, parseInt(e.target.value) || 1)}
              disabled={selectedIds.size > 0}
              className="input h-14 disabled:opacity-50"
            />
          </div>
        </div>

        <div className="flex flex-col items-end gap-4 md:flex-row">
          <div className="flex-1 space-y-2">
            <label
              className="text-xs font-semibold tracking-wide uppercase"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Search
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              className="input h-14"
              placeholder="Find by name or ID..."
            />
          </div>

          <button onClick={onStartProcess} className="btn btn-primary h-14 px-8">
            {selectedIds.size > 0 ? `${getModeLabel()} (${selectedIds.size})` : getModeLabel()}
          </button>
        </div>

        {selectedIds.size > 0 && (
          <div
            className="mt-6 rounded-lg border-2 p-4"
            style={{
              background: 'var(--bg-secondary)',
              borderColor: 'var(--accent-primary)',
              opacity: 0.9,
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold" style={{ color: 'var(--accent-primary)' }}>
                {selectedIds.size} selected
              </span>
              <button
                onClick={() => selectedIds.forEach(id => onToggleSelection(id))}
                className="text-xs font-medium transition-colors"
                style={{ color: 'var(--text-tertiary)' }}
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
                    className="cursor-pointer rounded px-2.5 py-1 text-xs font-medium shadow-sm transition-colors"
                    style={{ background: 'var(--surface-card)', color: 'var(--text-secondary)' }}
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
                className="h-20 animate-pulse rounded-lg border-2"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}
              />
            ))
          : filteredPokemon.map(p => {
              const isSelected = selectedIds.has(p.id);
              const hasSavedSummary = savedSummaryIds.has(p.id);
              const hasSavedAudio = savedAudioIds.has(p.id);
              return (
                <div
                  key={p.id}
                  onClick={() => onToggleSelection(p.id)}
                  className="group relative cursor-pointer rounded-lg border-2 p-3.5 transition-all hover:shadow-md"
                  style={{
                    background: isSelected ? 'var(--bg-secondary)' : 'var(--surface-card)',
                    borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-primary)',
                  }}
                >
                  <div className="absolute top-2 right-2 flex gap-1">
                    {hasSavedSummary && (
                      <div
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: 'var(--accent-secondary)' }}
                        title="Summary saved"
                      />
                    )}
                    {hasSavedAudio && (
                      <span title="Audio saved">
                        <Volume2 className="h-3 w-3" style={{ color: '#d97706' }} />
                      </span>
                    )}
                  </div>
                  <span
                    className="text-[9px] font-semibold tracking-wide"
                    style={{ color: isSelected ? 'var(--accent-primary)' : 'var(--text-tertiary)' }}
                  >
                    #{formatPokemonId(p.id)}
                  </span>
                  <h4
                    className="mt-1 truncate text-xs font-medium capitalize"
                    style={{ color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}
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
