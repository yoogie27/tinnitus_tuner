/**
 * SafeAudioEngine — centralised, volume-safe Web Audio engine for
 * tinnitus frequency matching and all therapy playback modes.
 *
 * Safety measures
 * ───────────────
 * 1. Hard gain cap (MAX_SAFE_GAIN) – master gain is NEVER set above this.
 * 2. Per-waveform scalars – harsh signals (square, white noise) are
 *    automatically attenuated so perceived loudness stays consistent.
 * 3. Soft fade-in on every start – avoids transient "click" damage.
 * 4. Soft fade-out on every stop.
 * 5. DynamicsCompressorNode as a brick-wall safety limiter after master
 *    gain — even if a bug pushes gain too high the limiter clamps output.
 * 6. All public volume setters clamp to [0, MAX_SAFE_GAIN].
 *
 * DISCLAIMER: This software is provided AS-IS.  We are NOT responsible
 * for any damage to loudspeakers or hearing.  Use at your own risk and
 * always start at LOW volume.
 */

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

// ─── Safety Constants ─────────────────────────────────────
const MAX_SAFE_GAIN = 0.45;          // absolute ceiling
const FADE_IN_SEC   = 0.35;          // seconds
const FADE_OUT_SEC  = 0.12;          // seconds
const MIN_FREQ      = 20;
const MAX_FREQ      = 20000;

/** Per-waveform attenuation so perceived loudness is roughly equal. */
const GAIN_SCALAR: Record<string, number> = {
  sine:     1.0,
  square:   0.15,
  sawtooth: 0.2,
  triangle: 0.5,
  white:    0.15,
  pink:     0.5,
  brown:    1.0,
};

// ─── Helpers ──────────────────────────────────────────────
function clampFreq(f: number): number {
  return Math.max(MIN_FREQ, Math.min(f, MAX_FREQ));
}

function clampGain(v: number): number {
  return Math.max(0, Math.min(v, MAX_SAFE_GAIN));
}

// ─── Engine ───────────────────────────────────────────────
class SafeAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;

  private sources: AudioScheduledSourceNode[] = [];
  private nodes: AudioNode[] = [];
  private noiseCache: Record<string, AudioBuffer> = {};
  private sequencerTimer: number | null = null;
  private riTimeout: number | null = null;

  private _vol = 0.12;
  private _playing = false;

  /* public getters */
  get volume(): number        { return this._vol; }
  get isPlaying(): boolean    { return this._playing; }
  get analyserNode(): AnalyserNode | null { return this.analyser; }

  // ── Audio Context ─────────────────────────────────────
  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  // ── Master chain (gain → limiter → analyser → destination) ──
  private master(): GainNode {
    const ctx = this.getCtx();
    if (!this.masterGain) {
      this.masterGain = ctx.createGain();
      this.masterGain.gain.value = 0;
    }
    if (!this.limiter) {
      this.limiter = ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -3;
      this.limiter.knee.value = 6;
      this.limiter.ratio.value = 20;
      this.limiter.attack.value = 0.002;
      this.limiter.release.value = 0.05;
    }
    if (!this.analyser) {
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 2048;
    }
    // reconnect (idempotent)
    try { this.masterGain.disconnect(); } catch {}
    try { this.limiter.disconnect(); } catch {}
    try { this.analyser.disconnect(); } catch {}
    this.masterGain.connect(this.limiter);
    this.limiter.connect(this.analyser);
    this.analyser.connect(ctx.destination);
    return this.masterGain;
  }

  // ── Volume ────────────────────────────────────────────
  setVolume(v: number): void {
    this._vol = clampGain(v);
    if (this.masterGain && this.ctx && this._playing) {
      this.masterGain.gain.setTargetAtTime(this._vol, this.ctx.currentTime, 0.05);
    }
  }

  // ── Fade helpers ──────────────────────────────────────
  private fadeIn(target: number): void {
    if (!this.masterGain || !this.ctx) return;
    const safe = clampGain(target);
    this.masterGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    this.masterGain.gain.exponentialRampToValueAtTime(
      Math.max(safe, 0.0001),
      this.ctx.currentTime + FADE_IN_SEC,
    );
  }

  // ── Cleanup ───────────────────────────────────────────
  private cleanup(): void {
    for (const s of this.sources) {
      try { s.stop(); } catch {}
      try { s.disconnect(); } catch {}
    }
    for (const n of this.nodes) {
      try { n.disconnect(); } catch {}
    }
    this.sources = [];
    this.nodes = [];
    if (this.sequencerTimer !== null) {
      clearInterval(this.sequencerTimer);
      this.sequencerTimer = null;
    }
    if (this.riTimeout !== null) {
      clearTimeout(this.riTimeout);
      this.riTimeout = null;
    }
    this._playing = false;
  }

  /** Stop with fade-out.  Returns a Promise that resolves once silent. */
  stop(): Promise<void> {
    if (!this._playing && this.sources.length === 0) {
      this.cleanup();
      return Promise.resolve();
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.025);
    }
    return new Promise(resolve => {
      setTimeout(() => { this.cleanup(); resolve(); }, FADE_OUT_SEC * 1000 + 60);
    });
  }

  // ── Noise buffer generation (cached) ──────────────────
  private noiseBuf(ctx: AudioContext, type: 'white' | 'pink' | 'brown'): AudioBuffer {
    if (this.noiseCache[type]) return this.noiseCache[type];
    const N = 2 * ctx.sampleRate;
    const buf = ctx.createBuffer(1, N, ctx.sampleRate);
    const d = buf.getChannelData(0);

    if (type === 'white') {
      for (let i = 0; i < N; i++) d[i] = Math.random() * 2 - 1;
    } else if (type === 'pink') {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < N; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.96900 * b2 + w * 0.1538520;
        b3 = 0.86650 * b3 + w * 0.3104856;
        b4 = 0.55000 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.0168980;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    } else {
      let last = 0;
      for (let i = 0; i < N; i++) {
        const w = Math.random() * 2 - 1;
        d[i] = (last + 0.02 * w) / 1.02;
        last = d[i];
        d[i] *= 3.5;
      }
    }
    this.noiseCache[type] = buf;
    return buf;
  }

  // ── Internal wiring helper ────────────────────────────
  private wire(source: AudioNode, ...intermediates: AudioNode[]): void {
    const m = this.master();
    let prev: AudioNode = source;
    for (const node of intermediates) {
      prev.connect(node);
      this.nodes.push(node);
      prev = node;
    }
    prev.connect(m);
  }

  // ═══════════════════════════════════════════════════════
  //  PUBLIC PLAYBACK METHODS
  // ═══════════════════════════════════════════════════════

  /** Simple oscillator tone. */
  async playTone(freq: number, wave: OscillatorType = 'sine'): Promise<void> {
    await this.stop();
    const ctx = this.getCtx();
    this.master();

    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.value = clampFreq(freq);
    this.wire(osc);
    osc.start();
    this.sources.push(osc);

    this._playing = true;
    this.fadeIn(this._vol * (GAIN_SCALAR[wave] ?? 1));
  }

  /** Noise source, optionally band-passed around a centre frequency. */
  async playNoise(
    color: 'white' | 'pink' | 'brown',
    centerFreq?: number,
    q = 1.0,
  ): Promise<void> {
    await this.stop();
    const ctx = this.getCtx();
    this.master();

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf(ctx, color);
    src.loop = true;

    if (centerFreq) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = clampFreq(centerFreq);
      bp.Q.value = q;
      this.wire(src, bp);
    } else {
      this.wire(src);
    }
    src.start();
    this.sources.push(src);

    this._playing = true;
    this.fadeIn(this._vol * (GAIN_SCALAR[color] ?? 0.3));
  }

  /**
   * Notched Sound Therapy
   * Broadband noise with a band-stop (notch) filter at the tinnitus frequency.
   */
  async playNotchedNoise(
    notchFreq: number,
    notchQ = 6,
    color: 'white' | 'pink' | 'brown' = 'pink',
  ): Promise<void> {
    await this.stop();
    const ctx = this.getCtx();
    this.master();

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf(ctx, color);
    src.loop = true;

    const notch = ctx.createBiquadFilter();
    notch.type = 'notch';
    notch.frequency.value = clampFreq(notchFreq);
    notch.Q.value = notchQ;

    this.wire(src, notch);
    src.start();
    this.sources.push(src);

    this._playing = true;
    this.fadeIn(this._vol * (GAIN_SCALAR[color] ?? 0.3));
  }

  /**
   * Coordinated Reset (CR) Neuromodulation
   * Four tones at fixed ratios around the tinnitus frequency,
   * played one at a time in random order (Tass et al.).
   */
  async playCoordinatedReset(
    centerFreq: number,
    tempoMs = 250,
  ): Promise<void> {
    await this.stop();
    const ctx = this.getCtx();
    this.master();

    const ratios = [0.773, 0.867, 1.133, 1.227];
    const oscs: OscillatorNode[] = [];
    const gains: GainNode[] = [];

    for (const r of ratios) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = clampFreq(centerFreq * r);

      const g = ctx.createGain();
      g.gain.value = 0;

      osc.connect(g);
      g.connect(this.master());
      osc.start();

      oscs.push(osc);
      gains.push(g);
      this.sources.push(osc);
      this.nodes.push(g);
    }

    this._playing = true;
    this.fadeIn(this._vol);

    let cur = -1;
    const step = () => {
      if (!this._playing) return;
      if (cur >= 0) gains[cur].gain.setTargetAtTime(0, ctx.currentTime, 0.015);
      let next: number;
      do { next = Math.floor(Math.random() * 4); } while (next === cur);
      cur = next;
      gains[cur].gain.setTargetAtTime(0.5, ctx.currentTime + 0.02, 0.015);
    };
    step();
    this.sequencerTimer = window.setInterval(step, tempoMs);
  }

  /**
   * Amplitude-Modulated tone at tinnitus frequency.
   */
  async playAM(
    freq: number,
    modRate = 10,
    modDepth = 0.7,
  ): Promise<void> {
    await this.stop();
    const ctx = this.getCtx();
    this.master();

    const carrier = ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.value = clampFreq(freq);

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = modRate;

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = modDepth * 0.5;

    const out = ctx.createGain();
    out.gain.value = 1 - modDepth * 0.5;

    lfo.connect(lfoGain);
    lfoGain.connect(out.gain);
    carrier.connect(out);
    out.connect(this.master());

    carrier.start();
    lfo.start();
    this.sources.push(carrier, lfo);
    this.nodes.push(lfoGain, out);

    this._playing = true;
    this.fadeIn(this._vol);
  }

  /**
   * Binaural Beats — requires headphones.
   * Left ear = baseFreq, right ear = baseFreq + beatFreq.
   */
  async playBinaural(baseFreq: number, beatFreq = 10): Promise<void> {
    await this.stop();
    const ctx = this.getCtx();
    this.master();

    const merger = ctx.createChannelMerger(2);

    const left = ctx.createOscillator();
    left.type = 'sine';
    left.frequency.value = clampFreq(baseFreq);

    const right = ctx.createOscillator();
    right.type = 'sine';
    right.frequency.value = clampFreq(baseFreq + beatFreq);

    left.connect(merger, 0, 0);
    right.connect(merger, 0, 1);
    merger.connect(this.master());

    left.start();
    right.start();
    this.sources.push(left, right);
    this.nodes.push(merger);

    this._playing = true;
    this.fadeIn(this._vol);
  }

  /**
   * Residual Inhibition — play masking tone for `durationSec` then auto-stop.
   */
  async playResidualInhibition(
    freq: number,
    durationSec = 60,
    onFinish?: () => void,
  ): Promise<void> {
    await this.playTone(freq, 'sine');
    this.riTimeout = window.setTimeout(async () => {
      await this.stop();
      onFinish?.();
    }, durationSec * 1000);
  }

  /**
   * Phase-cancelled tone (180° inverted duplicate).
   * Only meaningful with open-back headphones placed very specifically —
   * included for experimental / educational use.
   */
  async playPhaseCancellation(freq: number): Promise<void> {
    await this.stop();
    const ctx = this.getCtx();
    this.master();

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = clampFreq(freq);

    const invert = ctx.createGain();
    invert.gain.value = -1;

    osc.connect(invert);
    invert.connect(this.master());
    osc.start();

    this.sources.push(osc);
    this.nodes.push(invert);
    this._playing = true;
    this.fadeIn(this._vol);
  }

  // ── Live parameter updates ────────────────────────────

  updateOscFrequency(freq: number): void {
    if (!this.ctx) return;
    const f = clampFreq(freq);
    for (const s of this.sources) {
      if (s instanceof OscillatorNode) {
        s.frequency.setValueAtTime(f, this.ctx.currentTime);
      }
    }
  }

  updateFilterFrequency(freq: number): void {
    if (!this.ctx) return;
    for (const n of this.nodes) {
      if (n instanceof BiquadFilterNode) {
        n.frequency.setValueAtTime(clampFreq(freq), this.ctx.currentTime);
      }
    }
  }

  // ── Teardown ──────────────────────────────────────────

  destroy(): void {
    this.stop();
    setTimeout(() => {
      this.ctx?.close();
      this.ctx = null;
      this.masterGain = null;
      this.limiter = null;
      this.analyser = null;
    }, 300);
  }
}

/** Singleton — import this from anywhere. */
export const audioEngine = new SafeAudioEngine();
