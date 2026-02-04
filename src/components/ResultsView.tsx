import React from 'react';
import Image from 'next/image';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { ProcessedPokemon } from '../types';
import { pcmToWav } from '../services/audioUtils';
import { POKEBALL_IMAGE } from '../constants';
import { formatPokemonId } from '../utils/pokemonUtils';

interface ResultsViewProps {
  results: ProcessedPokemon[];
  onClear: () => void;
  onBack: () => void;
}

export const ResultsView: React.FC<ResultsViewProps> = ({ results, onClear, onBack }) => {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Generation Complete</h2>
          <p className="text-sm text-slate-500">{results.length} field logs generated</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-amber-100"
          >
            <ArrowLeft className="h-4 w-4" /> New Mission
          </button>
          <button
            onClick={onClear}
            className="flex items-center gap-2 rounded-lg bg-rose-100 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-200"
          >
            <Trash2 className="h-4 w-4" /> Clear Results
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {results.map(r => (
          <div key={r.id} className="rounded-xl border border-amber-100/80 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <Image
                src={r.pngData || r.svgData || POKEBALL_IMAGE}
                alt={r.name}
                width={48}
                height={48}
                className="h-12 w-12 object-contain"
              />
              <div>
                <span className="text-xs font-medium text-slate-400">#{formatPokemonId(r.id)}</span>
                <h3 className="font-semibold text-slate-800 capitalize">{r.name}</h3>
              </div>
            </div>
            <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-slate-500">{r.summary}</p>
            <audio controls className="h-8 w-full" src={pcmToWav(r.audioData)} />
          </div>
        ))}
      </div>
    </div>
  );
};
