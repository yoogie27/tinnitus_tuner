import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  ShieldAlert, ChevronRight, ChevronLeft, Play, Square,
  Volume2, Check, AlertTriangle, Headphones, Activity,
} from 'lucide-react';
import { WizardStep } from '../types';
import { audioEngine } from '../audioEngine';
import { Visualizer } from './Visualizer';

interface WizardProps {
  onComplete: (freq: number) => void;
  initialFreq?: number | null;
}

// ─── Reference frequencies for octave bracketing ─────────
const OCTAVE_REFS = [
  { freq: 250,   label: '250 Hz',   desc: 'Low hum' },
  { freq: 500,   label: '500 Hz',   desc: 'Mid-low' },
  { freq: 1000,  label: '1 kHz',    desc: 'Mid tone' },
  { freq: 2000,  label: '2 kHz',    desc: 'Upper-mid' },
  { freq: 3000,  label: '3 kHz',    desc: 'Mid-high' },
  { freq: 4000,  label: '4 kHz',    desc: 'Common tinnitus' },
  { freq: 6000,  label: '6 kHz',    desc: 'High' },
  { freq: 8000,  label: '8 kHz',    desc: 'Very high' },
  { freq: 10000, label: '10 kHz',   desc: 'Piercing' },
  { freq: 12000, label: '12 kHz',   desc: 'Very piercing' },
  { freq: 14000, label: '14 kHz',   desc: 'Ultra-high' },
  { freq: 16000, label: '16 kHz',   desc: 'Near-ultrasonic' },
];

const MIN_FREQ = 20;
const MAX_FREQ = 20000;

export const Wizard: React.FC<WizardProps> = ({ onComplete, initialFreq }) => {
  const [step, setStep] = useState<WizardStep>(WizardStep.DISCLAIMER);
  const [accepted, setAccepted] = useState(false);
  const [selectedRef, setSelectedRef] = useState<number | null>(null);
  const [frequency, setFrequency] = useState(initialFreq ?? 4000);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.12);
  const prevPlayingRef = useRef<number | null>(null);

  // Range for fine matching (set by octave bracket step)
  const [rangeMin, setRangeMin] = useState(MIN_FREQ);
  const [rangeMax, setRangeMax] = useState(MAX_FREQ);

  // Stop audio on unmount
  useEffect(() => () => { audioEngine.stop(); }, []);

  // Sync volume
  useEffect(() => { audioEngine.setVolume(volume); }, [volume]);

  // ── Audio helpers ──────────────────────────────────────
  const playFreq = useCallback(async (f: number) => {
    setPlaying(true);
    await audioEngine.playTone(f, 'sine');
  }, []);

  const stopSound = useCallback(async () => {
    await audioEngine.stop();
    setPlaying(false);
    prevPlayingRef.current = null;
  }, []);

  const toggleRef = useCallback(async (freq: number) => {
    if (prevPlayingRef.current === freq && playing) {
      await stopSound();
      setSelectedRef(null);
    } else {
      setSelectedRef(freq);
      prevPlayingRef.current = freq;
      await playFreq(freq);
    }
  }, [playing, playFreq, stopSound]);

  const toggleFine = useCallback(async () => {
    if (playing) {
      await stopSound();
    } else {
      await playFreq(frequency);
    }
  }, [playing, frequency, playFreq, stopSound]);

  // Update live frequency when slider changes during playback
  useEffect(() => {
    if (playing && step === WizardStep.FINE_MATCH) {
      audioEngine.updateOscFrequency(frequency);
    }
  }, [frequency, playing, step]);

  // ── Navigation ─────────────────────────────────────────
  const goNext = async () => {
    await stopSound();

    if (step === WizardStep.OCTAVE_BRACKET && selectedRef !== null) {
      // Determine fine-match range from selected octave
      const idx = OCTAVE_REFS.findIndex(r => r.freq === selectedRef);
      const lo = idx > 0 ? OCTAVE_REFS[idx - 1].freq : Math.max(MIN_FREQ, selectedRef / 2);
      const hi = idx < OCTAVE_REFS.length - 1 ? OCTAVE_REFS[idx + 1].freq : Math.min(MAX_FREQ, selectedRef * 2);
      setRangeMin(lo);
      setRangeMax(hi);
      setFrequency(selectedRef);
    }

    if (step === WizardStep.CONFIRM) {
      onComplete(frequency);
      return;
    }
    setStep(s => s + 1);
  };

  const goBack = async () => {
    await stopSound();
    setStep(s => Math.max(0, s - 1));
  };

  // ── Log slider helpers for fine match ──────────────────
  const logMin = Math.log(rangeMin);
  const logMax = Math.log(rangeMax);
  const logScale = (logMax - logMin) / 1000;

  const freqToSlider = useCallback(
    (f: number) => (Math.log(f) - logMin) / logScale,
    [logMin, logScale],
  );
  const sliderToFreq = useCallback(
    (v: number) => Math.round(Math.exp(logMin + logScale * v) * 10) / 10,
    [logMin, logScale],
  );

  const handleFineTune = (delta: number) => {
    setFrequency(f => {
      const next = Math.round((f + delta) * 10) / 10;
      return Math.max(rangeMin, Math.min(next, rangeMax));
    });
  };

  // ── Render per step ────────────────────────────────────
  const canAdvance = (): boolean => {
    switch (step) {
      case WizardStep.DISCLAIMER: return accepted;
      case WizardStep.OCTAVE_BRACKET: return selectedRef !== null;
      case WizardStep.FINE_MATCH: return true;
      case WizardStep.CONFIRM: return true;
      default: return false;
    }
  };

  const stepLabels = ['Safety', 'Range', 'Match', 'Confirm'];

  return (
    <div className="w-full max-w-2xl flex flex-col gap-6">
      {/* ── Progress indicator ── */}
      <div className="flex items-center justify-center gap-2 mb-2">
        {stepLabels.map((label, i) => (
          <React.Fragment key={i}>
            <div className="flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                i < step ? 'bg-cyan-600 text-white'
                : i === step ? 'bg-cyan-500 text-slate-900 ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-950'
                : 'bg-slate-800 text-slate-500'
              }`}>
                {i < step ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-[10px] ${i === step ? 'text-cyan-400' : 'text-slate-600'}`}>{label}</span>
            </div>
            {i < stepLabels.length - 1 && (
              <div className={`flex-1 h-px max-w-[40px] mt-[-14px] ${i < step ? 'bg-cyan-600' : 'bg-slate-800'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════ */}
      {/*  STEP 0 — DISCLAIMER                               */}
      {/* ════════════════════════════════════════════════════ */}
      {step === WizardStep.DISCLAIMER && (
        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-amber-500/10 p-2 rounded-lg">
              <ShieldAlert className="w-6 h-6 text-amber-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Welcome to Tinnitus Therapy</h2>
          </div>

          <p className="text-slate-300 text-sm mb-4">
            This application will guide you through <strong>matching your tinnitus frequency</strong>,
            and then offer multiple <strong>evidence-informed therapy approaches</strong> based on that
            frequency. All settings are saved in your browser.
          </p>

          {/* ── WARNING BOX ── */}
          <div className="bg-red-950/40 border border-red-800/60 rounded-xl p-4 mb-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-200 space-y-2">
                <p className="font-semibold text-red-300">Important Safety Information</p>
                <ul className="list-disc list-inside space-y-1 text-red-300/90">
                  <li>This is <strong>NOT</strong> a medical device and does <strong>NOT</strong> provide medical treatment.</li>
                  <li><strong>We are NOT responsible for any damage to loudspeakers or hearing.</strong></li>
                  <li>Using this application is <strong>entirely at your own risk</strong>.</li>
                  <li>Prolonged exposure to loud sounds can cause permanent hearing damage.</li>
                  <li><strong>Always start at the LOWEST volume</strong> and increase gradually.</li>
                  <li>If you experience pain, dizziness, or worsening tinnitus, <strong>stop immediately</strong>.</li>
                  <li>Consult an audiologist or ENT specialist for professional tinnitus evaluation.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* ── Headphones recommendation ── */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-2">
              <Headphones className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-slate-300">
                <p className="font-medium text-cyan-300 mb-1">Use headphones for best results</p>
                <p>Headphones provide more accurate frequency perception and are
                   required for some therapies (binaural beats). Keep volume LOW.</p>
              </div>
            </div>
          </div>

          {/* ── Accept checkbox ── */}
          <label className="flex items-start gap-3 cursor-pointer select-none group">
            <input
              type="checkbox"
              checked={accepted}
              onChange={e => setAccepted(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-900 cursor-pointer accent-cyan-500"
            />
            <span className="text-sm text-slate-200 group-hover:text-white transition-colors">
              I understand that this application is <strong>not a medical device</strong>,
              that I use it <strong>at my own risk</strong>, and that the creators are
              <strong> not responsible for any damage to my hearing or equipment</strong>.
              I will keep the volume at a safe level at all times.
            </span>
          </label>
        </div>
      )}

      {/* ════════════════════════════════════════════════════ */}
      {/*  STEP 1 — OCTAVE BRACKETING                        */}
      {/* ════════════════════════════════════════════════════ */}
      {step === WizardStep.OCTAVE_BRACKET && (
        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl">
          <h2 className="text-lg font-bold text-white mb-1">Find Your Frequency Range</h2>
          <p className="text-sm text-slate-400 mb-4">
            Tap each button to hear a reference tone. Select the one that sounds
            <strong className="text-cyan-300"> closest</strong> to your tinnitus pitch.
            We will refine it in the next step.
          </p>

          {/* Volume control */}
          <VolumeBar volume={volume} onChange={setVolume} />

          {/* Reference tone grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-4">
            {OCTAVE_REFS.map(ref => {
              const isActive = selectedRef === ref.freq && playing;
              const isSelected = selectedRef === ref.freq;
              return (
                <button
                  key={ref.freq}
                  onClick={() => toggleRef(ref.freq)}
                  className={`relative flex flex-col items-center gap-1 p-3 rounded-xl border transition-all active:scale-95 ${
                    isActive
                      ? 'bg-cyan-500/20 border-cyan-500 ring-1 ring-cyan-500/50'
                      : isSelected
                        ? 'bg-cyan-500/10 border-cyan-600'
                        : 'bg-slate-800 border-slate-700 hover:border-slate-600 hover:bg-slate-750'
                  }`}
                >
                  {isActive && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  )}
                  <span className={`text-sm font-mono font-bold ${isSelected ? 'text-cyan-300' : 'text-slate-200'}`}>
                    {ref.label}
                  </span>
                  <span className="text-[10px] text-slate-500">{ref.desc}</span>
                </button>
              );
            })}
          </div>

          {selectedRef && (
            <p className="text-center text-xs text-cyan-400 mt-4">
              Selected: <strong>{selectedRef} Hz</strong> — tap Next to fine-tune around this frequency.
            </p>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════ */}
      {/*  STEP 2 — FINE FREQUENCY MATCHING                  */}
      {/* ════════════════════════════════════════════════════ */}
      {step === WizardStep.FINE_MATCH && (
        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl">
          <h2 className="text-lg font-bold text-white mb-1">Match Your Tinnitus</h2>
          <p className="text-sm text-slate-400 mb-2">
            Adjust the slider until the tone <strong className="text-cyan-300">blends with or matches</strong> your
            tinnitus. Use the fine-tune buttons for precision. If you hear wavering
            (beating), you are close — keep adjusting until the beating slows and
            disappears.
          </p>

          {/* Visualizer */}
          <div className="my-4">
            <Visualizer analyser={audioEngine.analyserNode} isPlaying={playing} isPhaseInverted={false} />
          </div>

          {/* Frequency display */}
          <div className="text-center mb-4">
            <div className="text-slate-500 text-[10px] tracking-widest uppercase flex items-center justify-center gap-1 mb-1">
              <Activity className="w-3 h-3" /> Frequency
            </div>
            <div className="font-mono text-5xl font-light text-white tabular-nums tracking-tighter">
              {frequency.toFixed(1)}
              <span className="text-xl text-slate-500 ml-2">Hz</span>
            </div>
            <div className="text-[10px] text-slate-600 mt-1">Range: {rangeMin}–{rangeMax} Hz</div>
          </div>

          {/* Log slider */}
          <div className="px-2 mb-4">
            <input
              type="range"
              min="0"
              max="1000"
              step="1"
              value={freqToSlider(frequency)}
              onChange={e => setFrequency(sliderToFreq(Number(e.target.value)))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <div className="flex justify-between text-[10px] text-slate-600 mt-1 font-mono">
              <span>{rangeMin} Hz</span>
              <span>{rangeMax} Hz</span>
            </div>
          </div>

          {/* Fine-tune buttons */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[-100, -10, -1, -0.1, 0.1, 1, 10, 100].map(d => (
              <button
                key={d}
                onClick={() => handleFineTune(d)}
                className="py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono font-medium transition-colors active:bg-slate-600"
              >
                <span className={d > 0 ? 'text-cyan-400' : 'text-rose-400'}>
                  {d > 0 ? '+' : ''}{d} Hz
                </span>
              </button>
            ))}
          </div>

          {/* Play / stop + volume */}
          <div className="flex items-center gap-4">
            <button
              onClick={toggleFine}
              className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-all active:scale-95 ${
                playing
                  ? 'bg-rose-500 hover:bg-rose-600 text-white'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-slate-900'
              }`}
            >
              {playing ? <><Square className="w-5 h-5" /> Stop</> : <><Play className="w-5 h-5 fill-current" /> Play</>}
            </button>
          </div>

          <VolumeBar volume={volume} onChange={setVolume} className="mt-4" />

          {/* Tip */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 mt-4 text-xs text-slate-400">
            <strong className="text-slate-300">Tip — Beat Frequency Method:</strong> When the external
            tone is close to your tinnitus pitch you will hear a pulsating "wah-wah" beating effect.
            As you approach the exact frequency the beating slows down. When the beating stops,
            the frequencies are matched.
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════ */}
      {/*  STEP 3 — CONFIRMATION                             */}
      {/* ════════════════════════════════════════════════════ */}
      {step === WizardStep.CONFIRM && (
        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl text-center">
          <div className="inline-flex bg-cyan-500/10 p-3 rounded-full mb-4">
            <Check className="w-8 h-8 text-cyan-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Frequency Matched</h2>
          <div className="font-mono text-5xl font-light text-cyan-300 tabular-nums mb-2">
            {frequency.toFixed(1)}
            <span className="text-xl text-slate-500 ml-2">Hz</span>
          </div>
          <p className="text-sm text-slate-400 mb-6">
            All therapy approaches will be calibrated to this frequency.
            You can re-run the wizard at any time from the therapy hub.
          </p>

          <button
            onClick={async () => {
              await playFreq(frequency);
            }}
            className="mb-4 px-6 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm text-slate-200 transition-colors"
          >
            {playing ? '🔊 Listening…' : '▶ Play to verify'}
          </button>

          <VolumeBar volume={volume} onChange={setVolume} className="mb-4" />

          <p className="text-xs text-slate-500">
            Not quite right?  Go <strong>Back</strong> to fine-tune.
          </p>

          {/* Disclaimer reminder */}
          <div className="mt-6 p-3 rounded-lg bg-amber-950/30 border border-amber-900/40 text-[11px] text-amber-300/80">
            <AlertTriangle className="w-3 h-3 inline mr-1" />
            Reminder: We are NOT responsible for damage to hearing or equipment. Use at your own risk.
          </div>
        </div>
      )}

      {/* ── Navigation buttons ────────────────────────────── */}
      <div className="flex gap-3">
        {step > WizardStep.DISCLAIMER && (
          <button
            onClick={goBack}
            className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
        )}
        <button
          onClick={goNext}
          disabled={!canAdvance()}
          className={`flex-[2] py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
            canAdvance()
              ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-900 shadow-lg shadow-cyan-900/20'
              : 'bg-slate-800 text-slate-600 cursor-not-allowed'
          }`}
        >
          {step === WizardStep.CONFIRM ? (
            <>Go to Therapies <ChevronRight className="w-4 h-4" /></>
          ) : (
            <>Next <ChevronRight className="w-4 h-4" /></>
          )}
        </button>
      </div>
    </div>
  );
};

// ─── Shared volume bar ────────────────────────────────────
const VolumeBar: React.FC<{ volume: number; onChange: (v: number) => void; className?: string }> = ({
  volume,
  onChange,
  className = '',
}) => {
  const pct = Math.round(volume * 100 / 0.45); // show % of max safe gain
  const isHigh = volume > 0.25;
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Volume2 className={`w-4 h-4 flex-shrink-0 ${isHigh ? 'text-amber-400' : 'text-slate-400'}`} />
      <input
        type="range"
        min="0"
        max="0.45"
        step="0.005"
        value={volume}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-slate-400"
      />
      <span className={`text-xs font-mono w-8 text-right ${isHigh ? 'text-amber-400' : 'text-slate-500'}`}>
        {pct}%
      </span>
      {isHigh && (
        <span className="text-[10px] text-amber-400 animate-pulse">LOUD</span>
      )}
    </div>
  );
};
