import React from 'react';
import { Info, Activity } from 'lucide-react';

interface HeaderProps {
  onInfoClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onInfoClick }) => {
  return (
    <header className="w-full flex justify-between items-center py-4 border-b border-slate-800">
      <div className="flex items-center gap-3">
        <div className="bg-cyan-500/10 p-2 rounded-lg">
          <Activity className="w-6 h-6 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            Tinnitus Matcher
          </h1>
          <p className="text-xs text-slate-400">Frequency & Phase Tool</p>
        </div>
      </div>
      <button 
        onClick={onInfoClick}
        className="p-2 text-slate-400 hover:text-cyan-400 transition-colors rounded-full hover:bg-slate-900"
      >
        <Info className="w-5 h-5" />
      </button>
    </header>
  );
};