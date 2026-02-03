import React from 'react';
import { AppView } from '../types';

interface HeaderProps {
  onNavigate: (view: AppView) => void;
  currentView: AppView;
}

export const Header: React.FC<HeaderProps> = ({ onNavigate, currentView }) => {
  return (
    <header className="border-b border-slate-100 bg-white px-6 py-8">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <div className="cursor-pointer" onClick={() => onNavigate(AppView.HOME)}>
          <h1 className="text-xl font-semibold tracking-tight text-slate-800 transition-colors hover:text-slate-600">
            Field Logs
          </h1>
          <p className="text-xs text-slate-400">Pokédex Audio Generator</p>
        </div>
        <nav className="flex gap-1">
          {[
            { view: AppView.HOME, label: 'Home' },
            { view: AppView.SUMMARY_LIBRARY, label: 'Library' },
            { view: AppView.ADMIN, label: 'Settings' },
          ].map(({ view, label }) => (
            <button
              key={view}
              onClick={() => onNavigate(view)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                currentView === view
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
};
