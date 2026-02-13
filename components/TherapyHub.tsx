import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Play, Square, Volume2, ChevronLeft, AlertTriangle,
  Headphones, Activity, RefreshCw, Settings, Info,
  Music, Radio, Waves, Zap, Timer, ArrowLeft,
} from 'lucide-react';
import { TherapyId, TherapyMeta, NoiseColor } from '../types';
import { audioEngine } from '../audioEngine';
import { saveSettings, getTherapyParam, saveTherapyParam } from '../store';
import { Visualizer } from './Visualizer';

// ─── Therapy catalogue ────────────────────────────────────
const THERAPIES: TherapyMeta[] = [
  {
    id: 'notched-sound',
    title: 'Notched Sound Therapy',
    subtitle: 'Tailor-Made Notched Music Therapy (TMNMT)',
    description: 'Broadband noise with a spectral notch (gap) removed at your tinnitus frequency.',
    howItWorks:
      'By removing acoustic energy at your tinnitus frequency from the background sound, ' +
      'the auditory cortex receives less stimulation at that pitch.  Over time this promotes ' +
      '"lateral inhibition" — neighbouring neurons suppress activity at the tinnitus frequency, ' +
      'potentially reducing its perceived loudness.',
    research:
      'Okamoto et al. (2010) showed 12 months of listening to notched music significantly ' +
      'reduced tinnitus loudness vs. control. Published in PNAS.  Multiple follow-up studies ' +
      'have replicated the effect with varying notch widths.',
    headphonesRequired: false,
    safetyNote: 'Keep volume comfortable.  Sessions of 1–2 hours per day are commonly recommended in research.',
  },
  {
    id: 'narrowband-masking',
    title: 'Narrowband Masking',
    subtitle: 'Targeted frequency masking',
    description: 'Noise centred on your tinnitus frequency to directly mask the perceived sound.',
    howItWorks:
      'A band of noise is generated around your tinnitus frequency.  Because it occupies the ' +
      'same spectral region, it "covers" the tinnitus perception — your brain attends to the ' +
      'external sound instead.  Bandwidth and noise colour can be adjusted.',
    research:
      'Narrowband masking has been used clinically since the 1970s (Vernon, 1977).  Modern ' +
      'approaches refine the bandwidth and level to achieve "partial masking" for habituation.',
    headphonesRequired: false,
    safetyNote: 'Do not set volume louder than your tinnitus. Partial masking (just below full cover) is preferred.',
  },
  {
    id: 'broadband-masking',
    title: 'Broadband Masking',
    subtitle: 'White / Pink / Brown noise',
    description: 'Full-spectrum noise to provide overall masking and relaxation.',
    howItWorks:
      'Broadband noise engages the full auditory system, reducing the contrast between ' +
      'your tinnitus and the sound environment.  Pink and brown noise are often preferred ' +
      'because they are gentler on the ears (less high-frequency energy).',
    research:
      'Broadband sound therapy is a core component of Tinnitus Retraining Therapy (TRT), ' +
      'developed by Jastreboff & Hazell.  It is one of the most widely studied tinnitus ' +
      'management approaches.',
    headphonesRequired: false,
    safetyNote: 'Use at a soft background level — "mixing point" where tinnitus and noise are roughly equal.',
  },
  {
    id: 'coordinated-reset',
    title: 'Coordinated Reset',
    subtitle: 'CR Neuromodulation (Tass protocol)',
    description: 'Four tones around your tinnitus frequency played in random sequences.',
    howItWorks:
      'Tinnitus is thought to involve hyper-synchronised neural firing at the tinnitus ' +
      'frequency.  Coordinated Reset uses four precisely tuned tones at ratios around ' +
      'the tinnitus pitch, delivered in randomised order.  The goal is to disrupt and ' +
      '"desynchronise" the pathological neural pattern, reducing tinnitus over time.',
    research:
      'Developed by Prof. Peter Tass (Jülich Research Centre).  Clinical studies (Tass et al., ' +
      '2012) showed significant long-lasting tinnitus reduction.  The approach is based on ' +
      'computational neuroscience models of desynchronisation.',
    headphonesRequired: false,
    safetyNote: 'Typical sessions: 4–6 hours/day.  Volume should be just barely audible.',
  },
  {
    id: 'residual-inhibition',
    title: 'Residual Inhibition',
    subtitle: 'Temporary post-masking silence',
    description: 'Play your tinnitus frequency for 30–60 seconds, then stop. Many people experience brief relief.',
    howItWorks:
      'After exposure to a tone matching the tinnitus frequency for 30–60 seconds, many ' +
      'tinnitus sufferers experience a brief period of reduced or absent tinnitus (seconds ' +
      'to minutes).  This is called "residual inhibition."  While the effect is temporary, ' +
      'it can provide psychological relief and is used diagnostically by audiologists.',
    research:
      'First described by Feldmann (1971).  Roberts et al. (2008) found RI occurs in ~75% ' +
      'of tinnitus patients.  Duration and depth vary widely between individuals.',
    headphonesRequired: false,
    safetyNote: 'Volume should be slightly above your tinnitus level. Do NOT use excessive volume.',
  },
  {
    id: 'amplitude-modulation',
    title: 'Amplitude Modulation',
    subtitle: 'AM-modulated tinnitus tone',
    description: 'Your tinnitus frequency with rhythmic volume pulsation at a chosen rate.',
    howItWorks:
      'The tinnitus-matched tone is amplitude-modulated (volume pulsed) at a rate you choose ' +
      '(typically 1–40 Hz).  Some research suggests AM stimulation at specific rates may ' +
      'promote neural plasticity and habituation.  Slow rates (4–8 Hz, theta range) may ' +
      'aid relaxation; faster rates (10–12 Hz, alpha range) may promote focused attention.',
    research:
      'Tyler et al. (2014) explored various modulated stimuli for tinnitus.  AM tones are ' +
      'also used in auditory steady-state response (ASSR) testing in clinical audiology.',
    headphonesRequired: false,
    safetyNote: 'Keep volume low. Modulated sounds can feel more fatiguing over long sessions.',
  },
  {
    id: 'binaural-beats',
    title: 'Binaural Beats',
    subtitle: 'Stereo frequency difference (requires headphones)',
    description: 'Slightly different frequencies in each ear create a perceived "beat" in the brain.',
    howItWorks:
      'When the left ear receives one frequency and the right ear a slightly different one, ' +
      'the brain perceives a third "beat" tone at the frequency of the difference.  For example, ' +
      '400 Hz left + 410 Hz right = perceived 10 Hz binaural beat.  These beats may entrain ' +
      'brainwave activity.  Alpha-range beats (8–13 Hz) may promote relaxation; theta (4–7 Hz) ' +
      'for deep relaxation and sleep.',
    research:
      'Oster (1973) published the seminal paper on binaural beats.  David et al. (2010) found ' +
      'potential benefits for tinnitus in a controlled study.  Results are mixed but many users ' +
      'report subjective improvement in relaxation and sleep quality.',
    headphonesRequired: true,
    safetyNote: 'HEADPHONES REQUIRED.  Without headphones this therapy will not work as intended.',
  },
  {
    id: 'phase-cancellation',
    title: 'Phase Cancellation',
    subtitle: 'Anti-phase tone (experimental)',
    description: 'A 180°-inverted copy of your tinnitus frequency. Experimental / educational.',
    howItWorks:
      'In theory, if you could deliver a tone that is the exact inverse of your tinnitus ' +
      'signal, the two would cancel out (destructive interference).  In practice, tinnitus is ' +
      'a neural phenomenon — not an acoustic one — so true cancellation is not possible.  ' +
      'However, some users report that an anti-phase signal at their tinnitus frequency ' +
      'provides a different perceptual experience that they find interesting or mildly soothing.',
    research:
      'While acoustic phase cancellation is well-established physics (noise-cancelling headphones), ' +
      'applying it to tinnitus is experimental.  No large-scale clinical evidence supports this ' +
      'approach for tinnitus reduction.',
    headphonesRequired: false,
    safetyNote: 'This is experimental.  The inverted signal is still a sound — volume safety still applies.',
  },
];

// ─── Component ────────────────────────────────────────────
interface TherapyHubProps {
  frequency: number;
  onRerunWizard: () => void;
  onAdvancedMode: () => void;
}

export const TherapyHub: React.FC<TherapyHubProps> = ({
  frequency,
  onRerunWizard,
  onAdvancedMode,
}) => {
  const [activeTherapy, setActiveTherapy] = useState<TherapyId | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.12);
  const [showInfo, setShowInfo] = useState(false);

  // ── therapy-specific params (saved per therapy) ────────
  const [noiseColor, setNoiseColor] = useState<NoiseColor>('pink');
  const [notchQ, setNotchQ] = useState(6);
  const [bandwidth, setBandwidth] = useState(1);
  const [crTempo, setCrTempo] = useState(250);
  const [riDuration, setRiDuration] = useState(60);
  const [riRemaining, setRiRemaining] = useState(0);
  const [amRate, setAmRate] = useState(10);
  const [beatFreq, setBeatFreq] = useState(10);
  const riIntervalRef = useRef<number | null>(null);

  // Sync volume
  useEffect(() => { audioEngine.setVolume(volume); }, [volume]);

  // Cleanup on unmount
  useEffect(() => () => {
    audioEngine.stop();
    if (riIntervalRef.current) clearInterval(riIntervalRef.current);
  }, []);

  // Load saved params when switching therapy
  useEffect(() => {
    if (!activeTherapy) return;
    setNoiseColor(getTherapyParam(activeTherapy, 'noiseColor', 'pink') as NoiseColor);
    setNotchQ(getTherapyParam(activeTherapy, 'notchQ', 6));
    setBandwidth(getTherapyParam(activeTherapy, 'bandwidth', 1));
    setCrTempo(getTherapyParam(activeTherapy, 'crTempo', 250));
    setRiDuration(getTherapyParam(activeTherapy, 'riDuration', 60));
    setAmRate(getTherapyParam(activeTherapy, 'amRate', 10));
    setBeatFreq(getTherapyParam(activeTherapy, 'beatFreq', 10));
  }, [activeTherapy]);

  // ── playback ───────────────────────────────────────────
  const stopAll = useCallback(async () => {
    await audioEngine.stop();
    setPlaying(false);
    setRiRemaining(0);
    if (riIntervalRef.current) {
      clearInterval(riIntervalRef.current);
      riIntervalRef.current = null;
    }
  }, []);

  const startTherapy = useCallback(async () => {
    if (!activeTherapy) return;
    await stopAll();

    switch (activeTherapy) {
      case 'notched-sound':
        saveTherapyParam(activeTherapy, 'noiseColor', noiseColor);
        saveTherapyParam(activeTherapy, 'notchQ', notchQ);
        await audioEngine.playNotchedNoise(frequency, notchQ, noiseColor);
        break;
      case 'narrowband-masking':
        saveTherapyParam(activeTherapy, 'noiseColor', noiseColor);
        saveTherapyParam(activeTherapy, 'bandwidth', bandwidth);
        await audioEngine.playNoise(noiseColor, frequency, bandwidth);
        break;
      case 'broadband-masking':
        saveTherapyParam(activeTherapy, 'noiseColor', noiseColor);
        await audioEngine.playNoise(noiseColor);
        break;
      case 'coordinated-reset':
        saveTherapyParam(activeTherapy, 'crTempo', crTempo);
        await audioEngine.playCoordinatedReset(frequency, crTempo);
        break;
      case 'residual-inhibition': {
        saveTherapyParam(activeTherapy, 'riDuration', riDuration);
        setRiRemaining(riDuration);
        riIntervalRef.current = window.setInterval(() => {
          setRiRemaining(prev => {
            if (prev <= 1) {
              if (riIntervalRef.current) clearInterval(riIntervalRef.current);
              riIntervalRef.current = null;
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        await audioEngine.playResidualInhibition(frequency, riDuration, () => {
          setPlaying(false);
          setRiRemaining(0);
        });
        break;
      }
      case 'amplitude-modulation':
        saveTherapyParam(activeTherapy, 'amRate', amRate);
        await audioEngine.playAM(frequency, amRate);
        break;
      case 'binaural-beats':
        saveTherapyParam(activeTherapy, 'beatFreq', beatFreq);
        await audioEngine.playBinaural(frequency, beatFreq);
        break;
      case 'phase-cancellation':
        await audioEngine.playPhaseCancellation(frequency);
        break;
    }
    setPlaying(true);
    saveSettings({ lastTherapy: activeTherapy });
  }, [
    activeTherapy, frequency, noiseColor, notchQ, bandwidth,
    crTempo, riDuration, amRate, beatFreq, stopAll,
  ]);

  const togglePlay = useCallback(async () => {
    if (playing) await stopAll();
    else await startTherapy();
  }, [playing, stopAll, startTherapy]);

  const goBack = async () => {
    await stopAll();
    setActiveTherapy(null);
  };

  const meta = activeTherapy ? THERAPIES.find(t => t.id === activeTherapy)! : null;

  // ══════════════════════════════════════════════════════
  //  THERAPY LIST VIEW
  // ══════════════════════════════════════════════════════
  if (!activeTherapy) {
    return (
      <div className="w-full max-w-2xl flex flex-col gap-4">
        {/* Frequency badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span className="text-sm text-slate-300">
              Your tinnitus: <strong className="text-cyan-300 font-mono">{frequency.toFixed(1)} Hz</strong>
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onRerunWizard}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-cyan-400 transition-colors px-2 py-1 rounded-lg hover:bg-slate-800"
            >
              <RefreshCw className="w-3 h-3" /> Re-match
            </button>
            <button
              onClick={onAdvancedMode}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-cyan-400 transition-colors px-2 py-1 rounded-lg hover:bg-slate-800"
            >
              <Settings className="w-3 h-3" /> Advanced
            </button>
          </div>
        </div>

        {/* Disclaimer banner */}
        <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-900/40 text-[11px] text-amber-300/80 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            We are NOT responsible for damage to hearing or equipment. All therapies are
            experimental self-help tools — not medical treatment. <strong>Use at your own risk.
            Always keep volume LOW.</strong>
          </span>
        </div>

        <h2 className="text-lg font-bold text-white">Choose a Therapy</h2>

        {/* Therapy cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {THERAPIES.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTherapy(t.id)}
              className="text-left bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-all group"
            >
              <div className="flex items-start justify-between mb-1">
                <span className="text-sm font-semibold text-slate-100 group-hover:text-cyan-300 transition-colors">
                  {t.title}
                </span>
                {t.headphonesRequired && <Headphones className="w-3.5 h-3.5 text-slate-500" />}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">{t.description}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════
  //  ACTIVE THERAPY VIEW
  // ══════════════════════════════════════════════════════
  return (
    <div className="w-full max-w-2xl flex flex-col gap-4">
      {/* Back button */}
      <button
        onClick={goBack}
        className="self-start flex items-center gap-1 text-sm text-slate-400 hover:text-cyan-400 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> All Therapies
      </button>

      {/* Title card */}
      <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800">
        <div className="flex items-start justify-between mb-1">
          <div>
            <h2 className="text-lg font-bold text-white">{meta!.title}</h2>
            <p className="text-xs text-slate-500">{meta!.subtitle}</p>
          </div>
          <button onClick={() => setShowInfo(!showInfo)} className="text-slate-500 hover:text-cyan-400 transition-colors">
            <Info className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 mt-2 mb-3">
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-sm text-slate-400">
            Calibrated to <strong className="text-cyan-300 font-mono">{frequency.toFixed(1)} Hz</strong>
          </span>
          {meta!.headphonesRequired && (
            <span className="ml-auto flex items-center gap-1 text-[10px] text-amber-400">
              <Headphones className="w-3 h-3" /> Headphones required
            </span>
          )}
        </div>

        {/* Expandable info */}
        {showInfo && (
          <div className="mb-4 space-y-3 animate-in">
            <div className="bg-slate-800/50 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-cyan-400 mb-1">How It Works</h4>
              <p className="text-xs text-slate-300 leading-relaxed">{meta!.howItWorks}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-cyan-400 mb-1">Research Basis</h4>
              <p className="text-xs text-slate-300 leading-relaxed">{meta!.research}</p>
            </div>
          </div>
        )}

        {/* ── Therapy-specific controls ─────────────────── */}
        <div className="space-y-3 mb-4">
          {/* NOTCHED SOUND */}
          {activeTherapy === 'notched-sound' && (
            <>
              <NoiseColorPicker value={noiseColor} onChange={setNoiseColor} />
              <ParamSlider
                label="Notch Width (Q)"
                value={notchQ}
                min={1}
                max={30}
                step={0.5}
                displayValue={notchQ.toFixed(1)}
                hint="Higher Q = narrower notch. 4-8 is typical."
                onChange={setNotchQ}
              />
            </>
          )}

          {/* NARROWBAND MASKING */}
          {activeTherapy === 'narrowband-masking' && (
            <>
              <NoiseColorPicker value={noiseColor} onChange={setNoiseColor} />
              <ParamSlider
                label="Bandwidth (Q)"
                value={bandwidth}
                min={0.1}
                max={10}
                step={0.1}
                displayValue={bandwidth.toFixed(1)}
                hint="Lower Q = wider band. 0.5-2 for broad masking, 5-10 for tight."
                onChange={setBandwidth}
              />
            </>
          )}

          {/* BROADBAND MASKING */}
          {activeTherapy === 'broadband-masking' && (
            <NoiseColorPicker value={noiseColor} onChange={setNoiseColor} />
          )}

          {/* COORDINATED RESET */}
          {activeTherapy === 'coordinated-reset' && (
            <>
              <ParamSlider
                label="Tempo"
                value={crTempo}
                min={100}
                max={500}
                step={10}
                displayValue={`${crTempo} ms`}
                hint="Interval between tone switches. 200-300ms is typical."
                onChange={setCrTempo}
              />
              <div className="bg-slate-800/50 rounded-lg p-2 text-[10px] text-slate-500 font-mono">
                Tones: {[0.773, 0.867, 1.133, 1.227].map(r =>
                  `${Math.round(frequency * r)} Hz`
                ).join(' · ')}
              </div>
            </>
          )}

          {/* RESIDUAL INHIBITION */}
          {activeTherapy === 'residual-inhibition' && (
            <>
              <ParamSlider
                label="Duration"
                value={riDuration}
                min={10}
                max={120}
                step={5}
                displayValue={`${riDuration}s`}
                hint="How long to play the tone before auto-stop. 30-60s typical."
                onChange={setRiDuration}
              />
              {riRemaining > 0 && (
                <div className="flex items-center gap-2 bg-cyan-500/10 rounded-lg p-3 border border-cyan-500/30">
                  <Timer className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm text-cyan-300 font-mono">
                    {riRemaining}s remaining
                  </span>
                  <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-500 rounded-full transition-all"
                      style={{ width: `${(riRemaining / riDuration) * 100}%` }}
                    />
                  </div>
                </div>
              )}
              {riRemaining === 0 && playing === false && (
                <p className="text-xs text-slate-400 italic">
                  After the tone stops, notice any change in your tinnitus perception.
                  The quiet period is when residual inhibition occurs.
                </p>
              )}
            </>
          )}

          {/* AMPLITUDE MODULATION */}
          {activeTherapy === 'amplitude-modulation' && (
            <ParamSlider
              label="Modulation Rate"
              value={amRate}
              min={1}
              max={40}
              step={0.5}
              displayValue={`${amRate.toFixed(1)} Hz`}
              hint="Theta (4-8 Hz) for relaxation, Alpha (8-13 Hz) for focus."
              onChange={setAmRate}
            />
          )}

          {/* BINAURAL BEATS */}
          {activeTherapy === 'binaural-beats' && (
            <>
              <ParamSlider
                label="Beat Frequency"
                value={beatFreq}
                min={1}
                max={40}
                step={0.5}
                displayValue={`${beatFreq.toFixed(1)} Hz`}
                hint="Delta 1-4 Hz (sleep), Theta 4-8 (deep relax), Alpha 8-13 (calm focus)."
                onChange={setBeatFreq}
              />
              <div className="bg-slate-800/50 rounded-lg p-2 text-[10px] text-slate-500 font-mono">
                Left: {frequency.toFixed(1)} Hz · Right: {(frequency + beatFreq).toFixed(1)} Hz
              </div>
              <div className="flex items-center gap-2 bg-amber-950/30 rounded-lg p-2 border border-amber-900/40">
                <Headphones className="w-4 h-4 text-amber-400" />
                <span className="text-[11px] text-amber-300">Headphones are required for binaural beats to work.</span>
              </div>
            </>
          )}

          {/* PHASE CANCELLATION */}
          {activeTherapy === 'phase-cancellation' && (
            <div className="bg-slate-800/50 rounded-lg p-3 text-xs text-slate-400">
              <Zap className="w-4 h-4 text-pink-400 inline mr-1" />
              Generates a 180°-inverted sine wave at {frequency.toFixed(1)} Hz.
              This is experimental — true acoustic cancellation of neural tinnitus
              is not physically possible, but some users find the experience interesting.
            </div>
          )}
        </div>

        {/* Visualizer */}
        <Visualizer
          analyser={audioEngine.analyserNode}
          isPlaying={playing}
          isPhaseInverted={activeTherapy === 'phase-cancellation'}
        />

        {/* Play / Stop */}
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={togglePlay}
            className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-all active:scale-95 ${
              playing
                ? 'bg-rose-500 hover:bg-rose-600 text-white'
                : 'bg-cyan-500 hover:bg-cyan-400 text-slate-900'
            }`}
          >
            {playing ? <><Square className="w-5 h-5" /> Stop</> : <><Play className="w-5 h-5 fill-current" /> Start Therapy</>}
          </button>
        </div>

        {/* Volume */}
        <div className="mt-4">
          <VolumeControl volume={volume} onChange={setVolume} />
        </div>

        {/* Safety note */}
        <div className="mt-4 p-2.5 rounded-lg bg-amber-950/30 border border-amber-900/40 text-[10px] text-amber-300/80 flex items-start gap-2">
          <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <span>{meta!.safetyNote} — We are NOT responsible for damage to hearing or equipment. Use at your own risk.</span>
        </div>
      </div>
    </div>
  );
};

// ─── Reusable sub-components ──────────────────────────────

const NoiseColorPicker: React.FC<{
  value: NoiseColor;
  onChange: (c: NoiseColor) => void;
}> = ({ value, onChange }) => {
  const opts: { value: NoiseColor; label: string; desc: string }[] = [
    { value: 'white', label: 'White', desc: 'Flat spectrum, bright' },
    { value: 'pink', label: 'Pink', desc: '1/f, natural, balanced' },
    { value: 'brown', label: 'Brown', desc: '1/f², warm, bassy' },
  ];
  return (
    <div>
      <label className="text-xs text-slate-400 mb-1 block">Noise Colour</label>
      <div className="flex gap-2">
        {opts.map(o => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
              value === o.value
                ? 'bg-cyan-500/15 border-cyan-500 text-cyan-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
            }`}
          >
            <div>{o.label}</div>
            <div className="text-[9px] mt-0.5 opacity-60">{o.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

const ParamSlider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayValue: string;
  hint?: string;
  onChange: (v: number) => void;
}> = ({ label, value, min, max, step, displayValue, hint, onChange }) => (
  <div>
    <div className="flex items-center justify-between mb-1">
      <label className="text-xs text-slate-400">{label}</label>
      <span className="text-xs font-mono text-slate-300">{displayValue}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={e => onChange(parseFloat(e.target.value))}
      className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
    />
    {hint && <p className="text-[10px] text-slate-600 mt-1">{hint}</p>}
  </div>
);

const VolumeControl: React.FC<{
  volume: number;
  onChange: (v: number) => void;
}> = ({ volume, onChange }) => {
  const pct = Math.round(volume * 100 / 0.45);
  const isHigh = volume > 0.25;
  return (
    <div className="flex items-center gap-3">
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
        <span className="text-[10px] text-amber-400 animate-pulse font-semibold">LOUD</span>
      )}
    </div>
  );
};
