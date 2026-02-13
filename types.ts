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