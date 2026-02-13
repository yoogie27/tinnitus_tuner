import React from 'react';
import { Activity, ArrowLeft } from 'lucide-react';
import { AppView } from '../types';

interface HeaderProps {
  view: AppView;
  onBackToHub: () => void;
  frequency: number | null;
}

export const Header: React.FC<HeaderProps> = ({ view, onBackToHub, frequency }) => {
  return (
    <header className="w-full flex justify-between items-center py-4 border-b border-slate-800">
      <div className="flex items-center gap-3">
        <div className="bg-cyan-500/10 p-2 rounded-lg">
          <Activity className="w-6 h-6 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            Tinnitus Therapy
          </h1>
          <p className="text-xs text-slate-400">
            {view === 'wizard' && 'Frequency Matching Wizard'}
            {view === 'hub' && 'Therapy Hub'}
            {view === 'therapy' && 'Active Therapy'}
            {view === 'advanced' && 'Advanced Manual Mode'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {frequency !== null && view !== 'wizard' && (
          <span className="text-xs text-slate-500 font-mono hidden sm:block">
            {frequency.toFixed(1)} Hz
          </span>
        )}
        {view === 'advanced' && (
          <button
            onClick={onBackToHub}
            className="flex items-center gap-1 text-sm text-slate-400 hover:text-cyan-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4" /> Therapies
          </button>
        )}
      </div>
    </header>
  );
};
