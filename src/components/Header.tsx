import React from 'react';
import { Home, BookOpen, Settings, BookMarked } from 'lucide-react';
import { AppView } from '../types';

interface HeaderProps {
  onNavigate: (view: AppView) => void;
  currentView: AppView;
}

export const Header: React.FC<HeaderProps> = ({ onNavigate, currentView }) => {
  return (
    <header
      className="border-b-2 shadow-md"
      style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-elevated)' }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl shadow-lg"
            style={{ background: 'var(--accent-primary)' }}
          >
            <BookMarked className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Field Logs
            </h1>
            <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Pokédex Research System
            </p>
          </div>
        </div>

        <nav className="flex gap-2">
          <button
            onClick={() => onNavigate(AppView.HOME)}
            className={currentView === AppView.HOME ? 'btn btn-primary' : 'btn btn-ghost'}
          >
            <Home className="h-4 w-4" />
            Home
          </button>
          <button
            onClick={() => onNavigate(AppView.POKEDEX_LIBRARY)}
            className={
              currentView === AppView.POKEDEX_LIBRARY ? 'btn btn-primary' : 'btn btn-ghost'
            }
          >
            <BookOpen className="h-4 w-4" />
            Pokédex
          </button>
          <button
            onClick={() => onNavigate(AppView.ADMIN)}
            className={currentView === AppView.ADMIN ? 'btn btn-primary' : 'btn btn-ghost'}
          >
            <Settings className="h-4 w-4" />
            Settings
          </button>
        </nav>
      </div>
    </header>
  );
};
