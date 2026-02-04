import React, { useState, useMemo } from 'react';
import {
  Search,
  Download,
  ChevronDown,
  ChevronUp,
  Volume2,
  FileText,
  Sparkles,
  X,
  Check,
  ImageIcon,
} from 'lucide-react';
import { StoredSummary, StoredAudioLog } from '../services/storageService';
import { formatPokemonId } from '../utils/pokemonUtils';
import { pcmToWav } from '../services/audioUtils';
import JSZip from 'jszip';

interface PokedexEntry {
  id: number;
  name: string;
  region: string;
  generationId: number;
  summary?: string;
  audio?: {
    voice: string;
    audioBase64: string;
    audioFormat: 'pcm_s16le' | 'wav';
    sampleRate: number;
  };
  imagePngPath?: string | null;
  imageSvgPath?: string | null;
}

interface PokedexLibraryViewProps {
  summaries: StoredSummary[];
  audioLogs: StoredAudioLog[];
  onRefresh: () => void;
}

export const PokedexLibraryView: React.FC<PokedexLibraryViewProps> = ({ summaries, audioLogs }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [generationFilter, setGenerationFilter] = useState<number | 'all'>('all');
  const [regionFilter, setRegionFilter] = useState<string | 'all'>('all');
  const [contentFilter, setContentFilter] = useState<'all' | 'text' | 'audio' | 'complete'>('all');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectionMode, setSelectionMode] = useState<'manual' | 'range' | 'generation' | 'region'>(
    'manual'
  );
  const [rangeStart, setRangeStart] = useState<number>(1);
  const [rangeEnd, setRangeEnd] = useState<number>(151);

  const entries = useMemo(() => {
    const entryMap = new Map<number, PokedexEntry>();

    summaries.forEach(s => {
      entryMap.set(s.id, {
        id: s.id,
        name: s.name,
        region: s.region,
        generationId: s.generationId,
        summary: s.summary,
      });
    });

    audioLogs.forEach(a => {
      const existing = entryMap.get(a.id);
      if (existing) {
        existing.audio = {
          voice: a.voice,
          audioBase64: a.audioBase64,
          audioFormat: a.audioFormat,
          sampleRate: a.sampleRate,
        };
      } else {
        entryMap.set(a.id, {
          id: a.id,
          name: a.name,
          region: a.region,
          generationId: a.generationId,
          audio: {
            voice: a.voice,
            audioBase64: a.audioBase64,
            audioFormat: a.audioFormat,
            sampleRate: a.sampleRate,
          },
        });
      }
    });

    return Array.from(entryMap.values()).sort((a, b) => a.id - b.id);
  }, [summaries, audioLogs]);

  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      if (generationFilter !== 'all' && entry.generationId !== generationFilter) return false;
      if (regionFilter !== 'all' && entry.region !== regionFilter) return false;

      if (contentFilter === 'text' && !entry.summary) return false;
      if (contentFilter === 'audio' && !entry.audio) return false;
      if (contentFilter === 'complete' && (!entry.summary || !entry.audio)) return false;

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          entry.name.toLowerCase().includes(query) ||
          entry.id.toString().includes(query) ||
          entry.summary?.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [entries, generationFilter, regionFilter, contentFilter, searchQuery]);

  const generations = useMemo(() => {
    return [...new Set(entries.map(e => e.generationId))].sort();
  }, [entries]);

  const regions = useMemo(() => {
    return [...new Set(entries.map(e => e.region))].sort();
  }, [entries]);

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

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectionModeChange = (mode: typeof selectionMode) => {
    setSelectionMode(mode);
    const newSelection = new Set<number>();

    if (mode === 'range') {
      for (let i = rangeStart; i <= rangeEnd; i++) {
        if (filteredEntries.some(e => e.id === i)) {
          newSelection.add(i);
        }
      }
    } else if (mode === 'generation' && generationFilter !== 'all') {
      filteredEntries
        .filter(e => e.generationId === generationFilter)
        .forEach(e => newSelection.add(e.id));
    } else if (mode === 'region' && regionFilter !== 'all') {
      filteredEntries.filter(e => e.region === regionFilter).forEach(e => newSelection.add(e.id));
    }

    setSelectedIds(newSelection);
  };

  const handleDownload = async () => {
    if (selectedIds.size === 0) {
      alert('Please select at least one entry to download.');
      return;
    }

    const zip = new JSZip();
    const selectedEntries = entries.filter(e => selectedIds.has(e.id));

    for (const entry of selectedEntries) {
      const folder = zip.folder(`${formatPokemonId(entry.id)}-${entry.name}`);
      if (!folder) continue;

      if (entry.summary) {
        folder.file('field-log.txt', entry.summary);
      }

      if (entry.audio) {
        const audioBlob = await fetch(
          pcmToWav(entry.audio.audioBase64, entry.audio.sampleRate)
        ).then(res => res.blob());
        folder.file('audio.wav', audioBlob);
      }

      try {
        const cachedPokemonRes = await fetch(`/api/pokemon/${entry.id}`);
        const cachedPokemon = (await cachedPokemonRes.json()) as {
          imagePngPath?: string | null;
          imageSvgPath?: string | null;
        };

        if (cachedPokemon.imageSvgPath) {
          const svgRes = await fetch(cachedPokemon.imageSvgPath);
          const svgBlob = await svgRes.blob();
          folder.file('sprite.svg', svgBlob);
        } else if (cachedPokemon.imagePngPath) {
          const pngRes = await fetch(cachedPokemon.imagePngPath);
          const pngBlob = await pngRes.blob();
          folder.file('sprite.png', pngBlob);
        }
      } catch (e) {
        console.warn(`Failed to fetch images for ${entry.name}:`, e);
      }
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pokedex-entries-${Date.now()}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      {/* Compact Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Pokédex Library
          </h1>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {entries.length} entries • {selectedIds.size} selected
          </p>
        </div>
        <button
          onClick={handleDownload}
          disabled={selectedIds.size === 0}
          className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Download
        </button>
      </div>

      {/* Compact Filters Grid */}
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        {/* Search */}
        <div
          className="flex h-10 items-center gap-2 rounded-lg px-3 shadow-sm lg:col-span-2"
          style={{ border: '2px solid var(--border-primary)', background: 'var(--surface-input)' }}
        >
          <Search className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>

        {/* Generation Filter */}
        <select
          value={generationFilter}
          onChange={e =>
            setGenerationFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
          }
          className="select h-10 text-sm"
        >
          <option value="all">All Generations</option>
          {generations.map(g => (
            <option key={g} value={g}>
              Gen {g}
            </option>
          ))}
        </select>

        {/* Region Filter */}
        <select
          value={regionFilter}
          onChange={e => setRegionFilter(e.target.value)}
          className="select h-10 text-sm"
        >
          <option value="all">All Regions</option>
          {regions.map(r => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      {/* Content & Selection Filters - Single Row */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {/* Content Filter */}
        <div
          className="flex gap-1 rounded-lg p-0.5"
          style={{ border: '2px solid var(--border-primary)', background: 'var(--bg-tertiary)' }}
        >
          {(['all', 'text', 'audio', 'complete'] as const).map(filter => (
            <button
              key={filter}
              onClick={() => setContentFilter(filter)}
              className="rounded-md px-2 py-1 text-xs font-semibold transition-all"
              style={
                contentFilter === filter
                  ? {
                      background: 'var(--accent-primary)',
                      color: 'var(--text-inverse)',
                    }
                  : {
                      color: 'var(--text-secondary)',
                    }
              }
            >
              {filter === 'all'
                ? 'All'
                : filter === 'complete'
                  ? 'Complete'
                  : filter === 'text'
                    ? 'Text'
                    : 'Audio'}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="h-6 w-px" style={{ background: 'var(--border-secondary)' }} />

        {/* Selection Mode */}
        <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Select:
        </span>
        {(['manual', 'range', 'generation', 'region'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => handleSelectionModeChange(mode)}
            className="rounded-lg px-3 py-1 text-xs font-semibold transition-all"
            style={
              selectionMode === mode
                ? {
                    background: 'var(--accent-secondary)',
                    color: 'var(--text-inverse)',
                  }
                : {
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-secondary)',
                  }
            }
          >
            {mode === 'manual'
              ? 'Manual'
              : mode === 'range'
                ? 'Range'
                : mode === 'generation'
                  ? 'Gen'
                  : 'Region'}
          </button>
        ))}

        {/* Range Inputs */}
        {selectionMode === 'range' && (
          <>
            <input
              type="number"
              value={rangeStart}
              onChange={e => setRangeStart(Number(e.target.value))}
              className="input w-16 px-2 py-1 text-xs"
            />
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              -
            </span>
            <input
              type="number"
              value={rangeEnd}
              onChange={e => setRangeEnd(Number(e.target.value))}
              className="input w-16 px-2 py-1 text-xs"
            />
            <button
              onClick={() => handleSelectionModeChange('range')}
              className="btn btn-secondary px-2 py-1 text-xs"
            >
              Apply
            </button>
          </>
        )}

        {/* Clear Selection */}
        {selectedIds.size > 0 && (
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition-all"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredEntries.map(entry => {
          const isExpanded = expandedIds.has(entry.id);
          const isSelected = selectedIds.has(entry.id);
          const hasText = !!entry.summary;
          const hasAudio = !!entry.audio;

          return (
            <div
              key={entry.id}
              className={`relative overflow-hidden rounded-2xl border-4 transition-all ${
                isSelected
                  ? 'border-volcanic-500 bg-volcanic-50 shadow-xl'
                  : 'border-earth-200 bg-white shadow-lg hover:shadow-xl'
              }`}
            >
              <button
                onClick={() => toggleSelect(entry.id)}
                className={`absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all ${
                  isSelected
                    ? 'border-volcanic-600 bg-volcanic-600 text-white'
                    : 'border-earth-300 text-earth-600 hover:border-volcanic-400 bg-white'
                }`}
              >
                {isSelected && <Check className="h-5 w-5" />}
              </button>

              <div className="via-forest-50 to-sunlight-100 relative h-48 bg-gradient-to-br from-sky-100 p-6">
                <div className="absolute top-4 left-4 flex flex-col gap-2">
                  <span className="bg-earth-800 text-earth-50 rounded-full px-3 py-1 text-xs font-bold">
                    #{formatPokemonId(entry.id)}
                  </span>
                  {hasText && (
                    <span className="bg-forest-600 flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold text-white">
                      <FileText className="h-3 w-3" />
                      Text
                    </span>
                  )}
                  {hasAudio && (
                    <span className="bg-ocean-600 flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold text-white">
                      <Volume2 className="h-3 w-3" />
                      Audio
                    </span>
                  )}
                </div>

                <div className="flex h-full items-center justify-center">
                  <ImageIcon
                    className="h-20 w-20"
                    style={{ color: 'var(--text-tertiary)', opacity: 0.3 }}
                  />
                </div>
              </div>

              <div className="p-5">
                <h3 className="text-ocean-900 mb-1 text-xl font-bold capitalize">{entry.name}</h3>
                <p className="text-ocean-600 mb-3 text-sm">
                  {entry.region} • Gen {entry.generationId}
                </p>

                {hasText && (
                  <div className="mb-3">
                    <p
                      className={`text-earth-800 text-sm leading-relaxed ${isExpanded ? '' : 'line-clamp-3'}`}
                    >
                      {entry.summary}
                    </p>
                    <button
                      onClick={() => toggleExpand(entry.id)}
                      className="text-ocean-600 hover:text-ocean-700 mt-2 flex items-center gap-1 text-xs font-semibold"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-3 w-3" /> Show less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3 w-3" /> Read full entry
                        </>
                      )}
                    </button>
                  </div>
                )}

                {hasAudio && (
                  <div className="mt-3">
                    <audio
                      controls
                      className="w-full"
                      src={pcmToWav(entry.audio!.audioBase64, entry.audio!.sampleRate)}
                    />
                  </div>
                )}

                {!hasText && !hasAudio && (
                  <div className="bg-earth-50 rounded-lg p-4 text-center">
                    <Sparkles className="text-earth-400 mx-auto mb-2 h-6 w-6" />
                    <p className="text-earth-600 text-xs">No data available</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredEntries.length === 0 && (
        <div className="border-earth-200 rounded-2xl border-4 bg-white p-16 text-center">
          <Search className="text-earth-300 mx-auto mb-4 h-16 w-16" />
          <p className="text-earth-600 text-xl font-semibold">No entries found</p>
          <p className="text-earth-500 mt-2 text-sm">Try adjusting your filters or search query.</p>
        </div>
      )}
    </div>
  );
};
