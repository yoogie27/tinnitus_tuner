export enum AppMode {
  TUNING = 'TUNING',
  LOCKED = 'LOCKED'
}

export type WaveType = 'sine' | 'square' | 'triangle' | 'sawtooth' | 'white' | 'pink' | 'brown';

export interface AudioState {
  isPlaying: boolean;
  frequency: number;
  volume: number;
  isPhaseInverted: boolean;
  isMuted: boolean;
  waveType: WaveType;
}

// ─── Wizard ───────────────────────────────────────────────
export enum WizardStep {
  DISCLAIMER = 0,
  OCTAVE_BRACKET = 1,
  FINE_MATCH = 2,
  CONFIRM = 3,
}

// ─── Therapy Types ────────────────────────────────────────
export type TherapyId =
  | 'notched-sound'
  | 'narrowband-masking'
  | 'broadband-masking'
  | 'coordinated-reset'
  | 'residual-inhibition'
  | 'amplitude-modulation'
  | 'binaural-beats'
  | 'phase-cancellation';

export type NoiseColor = 'white' | 'pink' | 'brown';

export interface TherapyMeta {
  id: TherapyId;
  title: string;
  subtitle: string;
  description: string;
  howItWorks: string;
  research: string;
  headphonesRequired: boolean;
  safetyNote: string;
}

// ─── App Navigation ───────────────────────────────────────
export type AppView = 'wizard' | 'hub' | 'therapy' | 'advanced';

// ─── Persisted Settings ───────────────────────────────────
export interface UserSettings {
  tinnitusFrequency: number | null;
  disclaimerAccepted: boolean;
  wizardCompleted: boolean;
  volume: number;
  lastTherapy: TherapyId | null;
  /** Per-therapy saved params: { [therapyId]: { ...params } } */
  therapyParams: Record<string, Record<string, number | string | boolean>>;
}
