import React from 'react';
import Link from 'next/link';
import { Wand2, BookOpen, ArrowRight } from 'lucide-react';

interface HomeViewProps {
  summaryCount: number;
  audioCount: number;
}

export const HomeView: React.FC<HomeViewProps> = ({ summaryCount, audioCount }) => {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <h2 className="mb-3 text-center text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>
        Pokédex Field Logs
      </h2>
      <p
        className="mx-auto mb-12 max-w-2xl text-center text-base leading-relaxed"
        style={{ color: 'var(--text-secondary)' }}
      >
        Generate immersive field researcher logs with AI-powered text and speech synthesis.
      </p>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Link
          href="/generator"
          className="card group p-8 text-left transition-all hover:shadow-xl"
          style={{ borderWidth: '3px', borderColor: 'var(--border-primary)' }}
        >
          <div
            className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl shadow-lg transition-colors group-hover:scale-105"
            style={{ background: 'var(--accent-primary)', color: 'var(--text-inverse)' }}
          >
            <Wand2 className="h-7 w-7" />
          </div>
          <h3 className="mb-2 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Generate New Logs
          </h3>
          <p className="mb-4 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Create summaries and audio for Pokémon. Choose full pipeline, text-only, or audio-only
            modes.
          </p>
          <span
            className="inline-flex items-center gap-2 text-sm font-semibold"
            style={{ color: 'var(--accent-primary)' }}
          >
            Start generating <ArrowRight className="h-4 w-4" />
          </span>
        </Link>

        <Link
          href="/library"
          className="card group relative p-8 text-left transition-all hover:shadow-xl"
          style={{ borderWidth: '3px', borderColor: 'var(--border-primary)' }}
        >
          <div
            className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl shadow-lg transition-colors group-hover:scale-105"
            style={{ background: 'var(--accent-secondary)', color: 'var(--text-inverse)' }}
          >
            <BookOpen className="h-7 w-7" />
          </div>
          <h3 className="mb-2 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            View Library
          </h3>
          <p className="mb-4 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Browse, play, and download your saved field logs. Manage your Pokédex collection.
          </p>
          <span
            className="inline-flex items-center gap-2 text-sm font-semibold"
            style={{ color: 'var(--accent-secondary)' }}
          >
            Open library <ArrowRight className="h-4 w-4" />
          </span>

          {(summaryCount > 0 || audioCount > 0) && (
            <div className="absolute top-6 right-6 flex flex-col gap-2">
              {summaryCount > 0 && (
                <span className="badge badge-secondary shadow-md">{summaryCount} summaries</span>
              )}
              {audioCount > 0 && (
                <span className="badge badge-neutral shadow-md">{audioCount} audio</span>
              )}
            </div>
          )}
        </Link>
      </div>
    </div>
  );
};
