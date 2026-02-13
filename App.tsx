import React, { useState, useCallback } from 'react';
import { Wizard } from './components/Wizard';
import { TherapyHub } from './components/TherapyHub';
import { Tuner } from './components/Tuner';
import { Header } from './components/Header';
import { loadSettings, saveSettings } from './store';
import { AppView } from './types';
import { audioEngine } from './audioEngine';

export default function App() {
  const [settings, setSettings] = useState(loadSettings);
  const [view, setView] = useState<AppView>(() => {
    const s = loadSettings();
    return s.wizardCompleted && s.tinnitusFrequency !== null ? 'hub' : 'wizard';
  });

  // Stop audio when switching views
  const switchView = useCallback(async (v: AppView) => {
    await audioEngine.stop();
    setView(v);
  }, []);

  const handleWizardComplete = useCallback((freq: number) => {
    const updated = saveSettings({
      tinnitusFrequency: freq,
      wizardCompleted: true,
      disclaimerAccepted: true,
    });
    setSettings(updated);
    switchView('hub');
  }, [switchView]);

  const handleRerunWizard = useCallback(() => {
    switchView('wizard');
  }, [switchView]);

  const handleAdvancedMode = useCallback(() => {
    switchView('advanced');
  }, [switchView]);

  const handleBackToHub = useCallback(() => {
    switchView('hub');
  }, [switchView]);

  return (
    <div className="min-h-screen flex flex-col items-center p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto relative">
      <Header
        view={view}
        onBackToHub={handleBackToHub}
        frequency={settings.tinnitusFrequency}
      />

      <main className="w-full flex-1 flex flex-col items-center justify-start mt-6">
        {view === 'wizard' && (
          <Wizard
            onComplete={handleWizardComplete}
            initialFreq={settings.tinnitusFrequency}
          />
        )}

        {view === 'hub' && settings.tinnitusFrequency !== null && (
          <TherapyHub
            frequency={settings.tinnitusFrequency}
            onRerunWizard={handleRerunWizard}
            onAdvancedMode={handleAdvancedMode}
          />
        )}

        {view === 'advanced' && <Tuner />}
      </main>

      <footer className="mt-12 text-slate-500 text-sm text-center pb-4">
        <p className="text-xs">
          DISCLAIMER: This tool is for experimental self-help purposes only. It does NOT
          provide medical treatment. We are NOT responsible for any damage to hearing or
          loudspeakers. <strong>Use entirely at your own risk.</strong> Consult a qualified
          audiologist for professional tinnitus care.
        </p>
      </footer>
    </div>
  );
}
