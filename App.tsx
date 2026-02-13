import React, { useState, useEffect } from 'react';
import { Tuner } from './components/Tuner';
import { Header } from './components/Header';
import { InfoModal } from './components/InfoModal';
import { Volume2, Info } from 'lucide-react';

export default function App() {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className="min-h-screen flex flex-col items-center p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto relative">
      <Header onInfoClick={() => setShowInfo(true)} />
      
      <main className="w-full flex-1 flex flex-col items-center justify-center mt-6">
        <Tuner />
      </main>

      <footer className="mt-12 text-slate-500 text-sm text-center">
        <p>Use headphones for the best experience. Be careful with volume levels.</p>
        <p className="mt-2 text-xs">
          Disclaimer: This tool is for tinnitus matching and masking purposes only. 
          It does not provide medical treatment. Consult a doctor for persistent tinnitus.
        </p>
      </footer>

      {showInfo && <InfoModal onClose={() => setShowInfo(false)} />}
    </div>
  );
}