import React, { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
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
  Trash2,
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

interface CachedPokemonImage {
  id: number;
  imagePngPath?: string | null;
  imageSvgPath?: string | null;
}

interface PokedexLibraryViewProps {
  summaries: StoredSummary[];
  audioLogs: StoredAudioLog[];
  onRefresh: () => void;
  onDeleteSummaries?: (ids: number[]) => Promise<void>;
  onDeleteAudio?: (ids: number[]) => Promise<void>;
}

export const PokedexLibraryView: React.FC<PokedexLibraryViewProps> = ({
  summaries,
  audioLogs,
  onRefresh,
  onDeleteSummaries,
  onDeleteAudio,
}) => {
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
  const [pokemonImages, setPokemonImages] = useState<Map<number, CachedPokemonImage>>(new Map());
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchImages = async () => {
      const allIds = new Set([...summaries.map(s => s.id), ...audioLogs.map(a => a.id)]);
      const newImages = new Map<number, CachedPokemonImage>();

      for (const id of allIds) {
        try {
          const res = await fetch(`/api/pokemon/${id}`);
          if (res.ok) {
            const response = await res.json();
            const data = response.data;
            if (data && (data.imagePngPath || data.imageSvgPath)) {
              newImages.set(id, {
                id,
                imagePngPath: data.imagePngPath,
                imageSvgPath: data.imageSvgPath,
              });
            } else {
              // Fallback to PokeAPI sprites
              newImages.set(id, {
                id,
                imagePngPath: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`,
                imageSvgPath: null,
              });
            }
          } else {
            // API returned error, use PokeAPI fallback
            newImages.set(id, {
              id,
              imagePngPath: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`,
              imageSvgPath: null,
            });
          }
        } catch {
          // Fetch failed, use PokeAPI fallback
          newImages.set(id, {
            id,
            imagePngPath: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`,
            imageSvgPath: null,
          });
        }
      }

      setPokemonImages(newImages);
    };

    fetchImages();
  }, [summaries, audioLogs]);

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

      const filePrefix = `${formatPokemonId(entry.id)}-${entry.name}`;

      if (entry.summary) {
        folder.file(`${filePrefix}.txt`, entry.summary);
      }

      if (entry.audio) {
        const audioBlob = await fetch(
          pcmToWav(entry.audio.audioBase64, entry.audio.sampleRate)
        ).then(res => res.blob());
        folder.file(`${filePrefix}.wav`, audioBlob);
      }

      try {
        const cachedPokemonRes = await fetch(`/api/pokemon/${entry.id}`);
        const response = (await cachedPokemonRes.json()) as {
          success: boolean;
          data?: {
            imagePngPath?: string | null;
            imageSvgPath?: string | null;
          };
        };

        const cachedPokemon = response.data;

        if (cachedPokemon?.imageSvgPath) {
          const svgRes = await fetch(cachedPokemon.imageSvgPath);
          const svgBlob = await svgRes.blob();
          folder.file(`${filePrefix}.svg`, svgBlob);
        } else if (cachedPokemon?.imagePngPath) {
          const pngRes = await fetch(cachedPokemon.imagePngPath);
          const pngBlob = await pngRes.blob();
          folder.file(`${filePrefix}.png`, pngBlob);
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

  const handleDeleteSummaries = async () => {
    if (!onDeleteSummaries || selectedIds.size === 0) return;
    if (!confirm(`Delete text summaries for ${selectedIds.size} Pokémon?`)) return;

    setIsDeleting(true);
    try {
      await onDeleteSummaries(Array.from(selectedIds) as number[]);
      setSelectedIds(new Set());
      onRefresh();
    } catch (e) {
      console.error('Failed to delete summaries:', e);
      alert('Failed to delete summaries. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAudio = async () => {
    if (!onDeleteAudio || selectedIds.size === 0) return;
    if (!confirm(`Delete audio for ${selectedIds.size} Pokémon?`)) return;

    setIsDeleting(true);
    try {
      await onDeleteAudio(Array.from(selectedIds) as number[]);
      setSelectedIds(new Set());
      onRefresh();
    } catch (e) {
      console.error('Failed to delete audio:', e);
      alert('Failed to delete audio. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteBoth = async () => {
    if (!onDeleteSummaries || !onDeleteAudio || selectedIds.size === 0) return;
    if (!confirm(`Delete both text and audio for ${selectedIds.size} Pokémon?`)) return;

    setIsDeleting(true);
    try {
      const ids = Array.from(selectedIds) as number[];
      await Promise.all([onDeleteSummaries(ids), onDeleteAudio(ids)]);
      setSelectedIds(new Set());
      onRefresh();
    } catch (e) {
      console.error('Failed to delete:', e);
      alert('Failed to delete. Please try again.');
    } finally {
      setIsDeleting(false);
    }
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
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && onDeleteSummaries && (
            <button
              onClick={handleDeleteSummaries}
              disabled={isDeleting}
              className="btn btn-outline disabled:cursor-not-allowed disabled:opacity-50"
              style={{ borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)' }}
            >
              <Trash2 className="h-4 w-4" />
              Delete Text
            </button>
          )}
          {selectedIds.size > 0 && onDeleteAudio && (
            <button
              onClick={handleDeleteAudio}
              disabled={isDeleting}
              className="btn btn-outline disabled:cursor-not-allowed disabled:opacity-50"
              style={{ borderColor: '#d97706', color: '#d97706' }}
            >
              <Trash2 className="h-4 w-4" />
              Delete Audio
            </button>
          )}
          {selectedIds.size > 0 && onDeleteSummaries && onDeleteAudio && (
            <button
              onClick={handleDeleteBoth}
              disabled={isDeleting}
              className="btn btn-outline disabled:cursor-not-allowed disabled:opacity-50"
              style={{ borderColor: 'var(--text-tertiary)', color: 'var(--text-tertiary)' }}
            >
              <Trash2 className="h-4 w-4" />
              Delete Both
            </button>
          )}
          <button
            onClick={handleDownload}
            disabled={selectedIds.size === 0}
            className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
        </div>
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
          const cachedImage = pokemonImages.get(entry.id);
          const imageSrc = cachedImage?.imageSvgPath || cachedImage?.imagePngPath;

          return (
            <div
              key={entry.id}
              className="relative overflow-hidden rounded-2xl border-2 shadow-lg transition-all hover:shadow-xl"
              style={{
                background: 'var(--surface-card)',
                borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-primary)',
              }}
            >
              <button
                onClick={() => toggleSelect(entry.id)}
                className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all"
                style={{
                  background: isSelected ? 'var(--accent-primary)' : 'var(--surface-card)',
                  borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-secondary)',
                  color: isSelected ? 'var(--text-inverse)' : 'var(--text-tertiary)',
                }}
              >
                {isSelected && <Check className="h-5 w-5" />}
              </button>

              <div className="relative h-48 p-6" style={{ background: 'var(--bg-secondary)' }}>
                <div className="absolute top-4 left-4 flex flex-col gap-2">
                  <span
                    className="rounded-full px-3 py-1 text-xs font-bold"
                    style={{ background: 'var(--accent-primary)', color: 'var(--text-inverse)' }}
                  >
                    #{formatPokemonId(entry.id)}
                  </span>
                  {hasText && (
                    <span
                      className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold"
                      style={{
                        background: 'var(--accent-secondary)',
                        color: 'var(--text-inverse)',
                      }}
                    >
                      <FileText className="h-3 w-3" />
                      Text
                    </span>
                  )}
                  {hasAudio && (
                    <span
                      className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold"
                      style={{ background: '#d97706', color: 'var(--text-inverse)' }}
                    >
                      <Volume2 className="h-3 w-3" />
                      Audio
                    </span>
                  )}
                </div>

                <div className="flex h-full items-center justify-center">
                  {imageSrc ? (
                    <Image
                      src={imageSrc}
                      alt={entry.name}
                      width={96}
                      height={96}
                      className="h-24 w-24 object-contain"
                      unoptimized
                    />
                  ) : (
                    <ImageIcon
                      className="h-20 w-20"
                      style={{ color: 'var(--text-tertiary)', opacity: 0.3 }}
                    />
                  )}
                </div>
              </div>

              <div className="p-5" style={{ background: 'var(--surface-card)' }}>
                <h3
                  className="mb-1 text-xl font-bold capitalize"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {entry.name}
                </h3>
                <p className="mb-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {entry.region} • Gen {entry.generationId}
                </p>

                {hasText && (
                  <div className="mb-3">
                    <p
                      className={`text-sm leading-relaxed ${isExpanded ? '' : 'line-clamp-3'}`}
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {entry.summary}
                    </p>
                    <button
                      onClick={() => toggleExpand(entry.id)}
                      className="mt-2 flex items-center gap-1 text-xs font-semibold transition-colors"
                      style={{ color: 'var(--accent-secondary)' }}
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
                  <div
                    className="rounded-lg p-4 text-center"
                    style={{ background: 'var(--bg-secondary)' }}
                  >
                    <Sparkles
                      className="mx-auto mb-2 h-6 w-6"
                      style={{ color: 'var(--text-tertiary)' }}
                    />
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      No data available
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredEntries.length === 0 && (
        <div
          className="rounded-2xl border-2 p-16 text-center"
          style={{ background: 'var(--surface-card)', borderColor: 'var(--border-primary)' }}
        >
          <Search className="mx-auto mb-4 h-16 w-16" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-xl font-semibold" style={{ color: 'var(--text-secondary)' }}>
            No entries found
          </p>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-tertiary)' }}>
            Try adjusting your filters or search query.
          </p>
        </div>
      )}
    </div>
  );
};
