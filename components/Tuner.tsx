import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Lock, Unlock, Zap, Volume2, Waves, Activity } from 'lucide-react';
import { Visualizer } from './Visualizer';
import { AppMode, WaveType } from '../types';

// Add type augmentation for webkitAudioContext
declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

const MIN_FREQ = 20;
const MAX_FREQ = 20000;
const INITIAL_FREQ = 4000;

const WAVE_OPTIONS: { value: WaveType; label: string }[] = [
  { value: 'sine', label: 'Sine Wave' },
  { value: 'square', label: 'Square' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'sawtooth', label: 'Sawtooth' },
  { value: 'white', label: 'White Noise' },
  { value: 'pink', label: 'Pink Noise' },
  { value: 'brown', label: 'Brown Noise' },
];

// Safety scalars to prevent speaker damage and equalize perceived loudness
const WAVE_GAIN_SCALARS: Record<WaveType, number> = {
  sine: 1.0,
  square: 0.15,     // Square waves are very energetic
  sawtooth: 0.2,    // Sawtooth is also harsh
  triangle: 0.5,
  white: 0.15,      // White noise is full spectrum high energy
  pink: 0.5,        // Pink is 1/f, softer
  brown: 1.0,       // Brown is 1/f^2, much bass, usually needs boost or full scale
};

export const Tuner: React.FC = () => {
  // State with lazy initialization from localStorage
  const [isPlaying, setIsPlaying] = useState(false);
  
  const [frequency, setFrequency] = useState<number>(() => {
    const saved = localStorage.getItem('tinnitus_freq');
    return saved ? parseFloat(saved) : INITIAL_FREQ;
  });

  const [volume, setVolume] = useState<number>(() => {
    const saved = localStorage.getItem('tinnitus_vol');
    return saved ? parseFloat(saved) : 0.1;
  });

  const [mode, setMode] = useState<AppMode>(() => {
    const saved = localStorage.getItem('tinnitus_locked');
    return saved === 'true' ? AppMode.LOCKED : AppMode.TUNING;
  });

  const [waveType, setWaveType] = useState<WaveType>(() => {
    const saved = localStorage.getItem('tinnitus_wave');
    return (saved && WAVE_OPTIONS.some(o => o.value === saved)) ? (saved as WaveType) : 'sine';
  });

  const [isPhaseInverted, setIsPhaseInverted] = useState(false);
  
  // Audio Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioScheduledSourceNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const phaseGainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  
  // Cache for generated noise buffers
  const noiseBuffersRef = useRef<Record<string, AudioBuffer>>({});

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('tinnitus_freq', frequency.toString());
    
    // Update live audio nodes
    if (audioCtxRef.current) {
      const currentTime = audioCtxRef.current.currentTime;
      if (sourceRef.current instanceof OscillatorNode) {
        sourceRef.current.frequency.setValueAtTime(frequency, currentTime);
      }
      if (filterRef.current) {
        filterRef.current.frequency.setValueAtTime(frequency, currentTime);
      }
    }
  }, [frequency]);

  useEffect(() => {
    localStorage.setItem('tinnitus_vol', volume.toString());
    if (masterGainRef.current && audioCtxRef.current) {
      // Apply safety scalar
      const effectiveVol = volume * WAVE_GAIN_SCALARS[waveType];
      masterGainRef.current.gain.setTargetAtTime(effectiveVol, audioCtxRef.current.currentTime, 0.05);
    }
  }, [volume, waveType]);

  useEffect(() => {
    localStorage.setItem('tinnitus_locked', (mode === AppMode.LOCKED).toString());
  }, [mode]);

  useEffect(() => {
    localStorage.setItem('tinnitus_wave', waveType);
    if (isPlaying) {
      // Restart audio to change source type
      stopAudio();
      initAudio();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waveType]);

  useEffect(() => {
    if (phaseGainRef.current && audioCtxRef.current) {
       const targetGain = isPhaseInverted ? -1 : 1;
       phaseGainRef.current.gain.setValueAtTime(targetGain, audioCtxRef.current.currentTime);
    }
  }, [isPhaseInverted]);

  // Noise Generation Helper
  const getNoiseBuffer = (ctx: AudioContext, type: 'white' | 'pink' | 'brown'): AudioBuffer => {
    // Check cache first
    if (noiseBuffersRef.current[type]) {
      return noiseBuffersRef.current[type];
    }

    const bufferSize = 2 * ctx.sampleRate; // 2 seconds buffer
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);

    if (type === 'white') {
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
    } else if (type === 'pink') {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        output[i] *= 0.11; 
        b6 = white * 0.115926;
      }
    } else if (type === 'brown') {
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5; 
      }
    }
    
    // Cache result
    noiseBuffersRef.current[type] = buffer;
    return buffer;
  };

  const initAudio = () => {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new AudioContextClass();
    }
    
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    if (!sourceRef.current) {
      const ctx = audioCtxRef.current;
      
      const phaseGain = ctx.createGain();
      const masterGain = ctx.createGain();
      const analyser = ctx.createAnalyser();

      // Apply initial gain with safety scalar
      const effectiveVol = volume * WAVE_GAIN_SCALARS[waveType];
      masterGain.gain.setValueAtTime(effectiveVol, ctx.currentTime);
      phaseGain.gain.setValueAtTime(isPhaseInverted ? -1 : 1, ctx.currentTime);
      analyser.fftSize = 2048;

      let sourceNode: AudioScheduledSourceNode;

      if (['white', 'pink', 'brown'].includes(waveType)) {
        // Noise Source
        const buffer = getNoiseBuffer(ctx, waveType as any);
        const bufferSource = ctx.createBufferSource();
        bufferSource.buffer = buffer;
        bufferSource.loop = true;
        sourceNode = bufferSource;

        // Create Bandpass filter for tunable noise
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(frequency, ctx.currentTime);
        filter.Q.value = 1.0; 
        
        // Connect
        sourceNode.connect(filter);
        filter.connect(phaseGain);
        filterRef.current = filter;
      } else {
        // Oscillator Source
        const osc = ctx.createOscillator();
        osc.type = waveType as OscillatorType;
        osc.frequency.setValueAtTime(frequency, ctx.currentTime);
        sourceNode = osc;
        
        // Connect
        sourceNode.connect(phaseGain);
        filterRef.current = null;
      }

      phaseGain.connect(masterGain);
      masterGain.connect(analyser);
      analyser.connect(ctx.destination);

      sourceNode.start();
      sourceRef.current = sourceNode;
      masterGainRef.current = masterGain;
      phaseGainRef.current = phaseGain;
      analyserRef.current = analyser;
    }
  };

  const stopAudio = () => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
        sourceRef.current.disconnect();
      } catch (e) {
        // Ignore already stopped errors
      }
      sourceRef.current = null;
    }
    if (filterRef.current) {
      filterRef.current.disconnect();
      filterRef.current = null;
    }
  };

  const togglePlay = () => {
    if (isPlaying) {
      stopAudio();
    } else {
      initAudio();
    }
    setIsPlaying(!isPlaying);
  };

  const handleFineTune = (amount: number) => {
    setFrequency(prev => {
      const newFreq = prev + amount;
      return Math.min(Math.max(newFreq, MIN_FREQ), MAX_FREQ);
    });
  };

  const handleLogSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const minLog = Math.log(MIN_FREQ);
    const maxLog = Math.log(MAX_FREQ);
    const scale = (maxLog - minLog) / 100;
    const value = Math.exp(minLog + scale * parseFloat(e.target.value));
    setFrequency(Math.round(value * 10) / 10);
  };

  const getSliderValue = useCallback(() => {
    const minLog = Math.log(MIN_FREQ);
    const maxLog = Math.log(MAX_FREQ);
    const scale = (maxLog - minLog) / 100;
    return (Math.log(frequency) - minLog) / scale;
  }, [frequency]);

  const isLocked = mode === AppMode.LOCKED;
  const isNoise = ['white', 'pink', 'brown'].includes(waveType);

  return (
    <div className="w-full max-w-2xl flex flex-col gap-6">
      
      {/* Visualizer Area */}
      <Visualizer 
        analyser={analyserRef.current} 
        isPlaying={isPlaying} 
        isPhaseInverted={isPhaseInverted}
      />

      {/* Main Control Panel */}
      <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl">
        
        {/* Wave Selection */}
        <div className={`flex justify-center mb-6 transition-opacity duration-300 ${isLocked ? 'opacity-50 pointer-events-none' : ''}`}>
           <div className="inline-flex bg-slate-800 p-1 rounded-xl relative">
              <select 
                value={waveType}
                onChange={(e) => setWaveType(e.target.value as WaveType)}
                className="bg-transparent text-slate-200 text-sm font-medium py-2 pl-9 pr-8 rounded-lg focus:outline-none cursor-pointer hover:bg-slate-700/50 transition-colors appearance-none"
              >
                {WAVE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value} className="bg-slate-800 text-white">
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-cyan-400">
                <Waves className="w-4 h-4" />
              </div>
           </div>
        </div>

        {/* Frequency Display */}
        <div className="text-center mb-8">
          <div className="text-slate-400 text-xs font-bold tracking-widest mb-2 uppercase flex items-center justify-center gap-2">
            {isNoise ? <><Activity className="w-3 h-3" /> Center Frequency</> : 'Frequency'}
          </div>
          <div className="font-mono text-6xl font-light text-white tabular-nums tracking-tighter">
            {frequency.toFixed(1)}
            <span className="text-2xl text-slate-500 ml-2">Hz</span>
          </div>
        </div>

        {/* Locked Overlay / Tuning Controls */}
        <div className={`relative transition-all duration-300 ${isLocked ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
          
          {/* Slider */}
          <div className="mb-8 px-2">
            <input
              type="range"
              min="0"
              max="100"
              step="0.1"
              value={getSliderValue()}
              onChange={handleLogSliderChange}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              disabled={isLocked}
            />
            <div className="flex justify-between text-xs text-slate-500 mt-2 font-mono">
              <span>20 Hz</span>
              <span>1 kHz</span>
              <span>20 kHz</span>
            </div>
          </div>

          {/* Fine Tuning Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <FineTuneButton amount={-100} label="-100 Hz" onClick={() => handleFineTune(-100)} />
            <FineTuneButton amount={-1} label="-1 Hz" onClick={() => handleFineTune(-1)} />
            <FineTuneButton amount={1} label="+1 Hz" onClick={() => handleFineTune(1)} />
            <FineTuneButton amount={100} label="+100 Hz" onClick={() => handleFineTune(100)} />
            
            <FineTuneButton amount={-10} label="-10 Hz" onClick={() => handleFineTune(-10)} />
            <FineTuneButton amount={-0.1} label="-0.1 Hz" onClick={() => handleFineTune(-0.1)} />
            <FineTuneButton amount={0.1} label="+0.1 Hz" onClick={() => handleFineTune(0.1)} />
            <FineTuneButton amount={10} label="+10 Hz" onClick={() => handleFineTune(10)} />
          </div>

        </div>

        {/* Primary Actions Row */}
        <div className="flex flex-col sm:flex-row items-center gap-4 border-t border-slate-800 pt-6">
          
          {/* Lock Toggle */}
          <button
            onClick={() => setMode(isLocked ? AppMode.TUNING : AppMode.LOCKED)}
            className={`flex-1 w-full py-4 rounded-xl flex items-center justify-center gap-2 font-semibold transition-all ${
              isLocked 
                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/50 hover:bg-amber-500/20' 
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {isLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
            {isLocked ? 'Locked' : 'Lock'}
          </button>

          {/* Play/Pause Main Button */}
          <button
            onClick={togglePlay}
            className={`flex-[2] w-full py-4 rounded-xl flex items-center justify-center gap-3 text-lg font-bold shadow-lg transition-all transform active:scale-95 ${
              isPlaying 
                ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-900/20' 
                : 'bg-cyan-500 hover:bg-cyan-400 text-slate-900 shadow-cyan-900/20'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-6 h-6 fill-current" /> Stop
              </>
            ) : (
              <>
                <Play className="w-6 h-6 fill-current" /> Play
              </>
            )}
          </button>
        </div>
      </div>

      {/* Secondary Controls (Phase & Volume) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        
        {/* Phase Inversion Control */}
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-slate-100 font-medium flex items-center gap-2">
                <Zap className={`w-4 h-4 ${isPhaseInverted ? 'text-pink-500' : 'text-slate-500'}`} />
                Phase Shift
              </div>
              <div className="text-xs text-slate-500 mt-1">Invert waveform (180°)</div>
            </div>
            <button
              onClick={() => setIsPhaseInverted(!isPhaseInverted)}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none ${
                isPhaseInverted ? 'bg-pink-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`${
                  isPhaseInverted ? 'translate-x-7' : 'translate-x-1'
                } inline-block h-6 w-6 transform rounded-full bg-white transition-transform`}
              />
            </button>
        </div>

        {/* Volume Control */}
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2">
              <Volume2 className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-200">Volume</span>
              <span className="ml-auto text-xs text-slate-500 font-mono">{Math.round(volume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-slate-400"
            />
        </div>

      </div>
    </div>
  );
};

// Helper Component for Fine Tuning
const FineTuneButton: React.FC<{ amount: number; label: string; onClick: () => void }> = ({ amount, label, onClick }) => {
  const isPositive = amount > 0;
  return (
    <button
      onClick={onClick}
      className="group flex items-center justify-center gap-1 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 transition-all active:bg-slate-600"
    >
      <span className={`text-xs font-mono font-medium ${isPositive ? 'text-cyan-400' : 'text-rose-400'}`}>
        {isPositive ? '+' : ''}{label}
      </span>
    </button>
  );
};