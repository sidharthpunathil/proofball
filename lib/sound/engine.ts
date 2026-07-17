// ProofBall sound engine.
//
// A tiny zero-asset Web Audio synth. Every sound the app makes is generated
// procedurally here (oscillators + noise + gain envelopes), so there are no
// audio files to ship, load, or license, and the whole palette retunes from
// code. Think "clean fintech arcade": subtle confirms + a light reward layer,
// all pitched to one pentatonic scale so overlapping sounds never clash.
//
// SSR-safe: no AudioContext is touched at import time. The context is created
// lazily and only resumed after a real user gesture (browser autoplay policy),
// via engine.unlock().

/** A minor pentatonic (A C D E G) across a couple of octaves, in Hz.
 *  All melodic voices pick notes from this table, so any combination that
 *  overlaps in time is still consonant. */
export const NOTES = {
  A2: 110.0,
  C3: 130.81,
  D3: 146.83,
  E3: 164.81,
  G3: 196.0,
  A3: 220.0,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  G4: 392.0,
  A4: 440.0,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  G5: 783.99,
  A5: 880.0,
  C6: 1046.5,
  E6: 1318.5,
} as const;

/** Ordered scale for streak-pitch mapping (climbs as the streak grows). */
export const SCALE_UP = [
  NOTES.A3,
  NOTES.C4,
  NOTES.D4,
  NOTES.E4,
  NOTES.G4,
  NOTES.A4,
  NOTES.C5,
  NOTES.D5,
  NOTES.E5,
  NOTES.G5,
  NOTES.A5,
  NOTES.C6,
] as const;

export interface ToneOpts {
  /** Frequency in Hz. */
  freq: number;
  /** Start time, seconds relative to now (default 0). */
  when?: number;
  /** Total voiced duration in seconds. */
  dur?: number;
  type?: OscillatorType;
  /** Peak gain 0..1 (pre master). */
  gain?: number;
  /** Envelope, seconds. */
  attack?: number;
  release?: number;
  /** Optional pitch glide target in Hz, reached over the note. */
  glideTo?: number;
  /** Optional detuned second osc for a fuller voice (cents). */
  detune?: number;
  /** Lowpass cutoff in Hz (applied to this voice only). */
  lowpass?: number;
}

export interface NoiseOpts {
  when?: number;
  dur?: number;
  gain?: number;
  attack?: number;
  release?: number;
  /** "highpass" for airy ticks/swishes, "lowpass" for thumps. */
  filter?: BiquadFilterType;
  /** Filter cutoff in Hz. */
  freq?: number;
  /** Sweep the filter to this cutoff over the sound (for whooshes). */
  sweepTo?: number;
  /** Filter resonance. */
  q?: number;
}

const LS_KEY = "pb:muted";

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private unlocked = false;
  private _muted = false;
  private _volume = 0.5;
  private lastAt: Record<string, number> = {};
  private listeners = new Set<() => void>();

  constructor() {
    if (typeof window !== "undefined") {
      try {
        this._muted = window.localStorage.getItem(LS_KEY) === "1";
      } catch {
        /* storage blocked; default on */
      }
    }
  }

  // --- mute state (observable, for useSyncExternalStore) ---
  get muted(): boolean {
    return this._muted;
  }
  setMuted(v: boolean): void {
    this._muted = v;
    try {
      window.localStorage.setItem(LS_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (this.master && this.ctx) {
      // Smoothly ride the master gain so toggling never clicks.
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(v ? 0 : this._volume, t, 0.02);
    }
    this.emit();
    if (!v) this.unlock(); // turning sound on counts as intent to hear it
  }
  toggleMuted(): void {
    this.setMuted(!this._muted);
  }
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    this.listeners.forEach((l) => l());
  }

  // --- context lifecycle ---
  /** Create/resume the AudioContext. Safe to call on every user gesture. */
  unlock(): void {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      try {
        this.ctx = new Ctor();
      } catch {
        return;
      }
      const master = this.ctx.createGain();
      master.gain.value = this._muted ? 0 : this._volume;
      // A gentle limiter keeps layered sounds from ever clipping.
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 24;
      comp.ratio.value = 12;
      comp.attack.value = 0.003;
      comp.release.value = 0.18;
      master.connect(comp).connect(this.ctx.destination);
      this.master = master;
      this.noiseBuffer = this.buildNoise();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    this.unlocked = true;
  }

  private buildNoise(): AudioBuffer | null {
    if (!this.ctx) return null;
    const len = Math.floor(this.ctx.sampleRate * 0.6);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** Wall-clock throttle so rapid identical triggers don't machine-gun. */
  private allow(key: string, minGapMs: number): boolean {
    const t = typeof performance !== "undefined" ? performance.now() : 0;
    const prev = this.lastAt[key] ?? -Infinity;
    if (t - prev < minGapMs) return false;
    this.lastAt[key] = t;
    return true;
  }

  /** True when a sound could actually be heard right now. */
  get live(): boolean {
    return !!this.ctx && this.unlocked && !this._muted;
  }
  get time(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  // --- voices ---
  /** A pitched note with an attack/exponential-release envelope. */
  tone(o: ToneOpts): void {
    if (!this.live || !this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + (o.when ?? 0);
    const dur = o.dur ?? 0.18;
    const attack = o.attack ?? 0.006;
    const release = o.release ?? Math.max(0.04, dur * 0.7);
    const peak = o.gain ?? 0.2;

    const osc = this.ctx.createOscillator();
    osc.type = o.type ?? "sine";
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.glideTo), t0 + dur);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + release);

    let node: AudioNode = osc;
    if (o.lowpass) {
      const lp = this.ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = o.lowpass;
      osc.connect(lp);
      node = lp;
    }
    node.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + attack + release + 0.02);

    if (o.detune) {
      const osc2 = this.ctx.createOscillator();
      osc2.type = o.type ?? "sine";
      osc2.frequency.setValueAtTime(o.freq, t0);
      osc2.detune.value = o.detune;
      if (o.glideTo) osc2.frequency.exponentialRampToValueAtTime(Math.max(1, o.glideTo), t0 + dur);
      const g2 = this.ctx.createGain();
      g2.gain.setValueAtTime(0.0001, t0);
      g2.gain.exponentialRampToValueAtTime(peak * 0.6, t0 + attack);
      g2.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + release);
      osc2.connect(g2).connect(this.master);
      osc2.start(t0);
      osc2.stop(t0 + attack + release + 0.02);
    }
  }

  /** A burst of filtered noise — ticks, swishes, thumps, crowd texture. */
  noise(o: NoiseOpts): void {
    if (!this.live || !this.ctx || !this.master || !this.noiseBuffer) return;
    const t0 = this.ctx.currentTime + (o.when ?? 0);
    const dur = o.dur ?? 0.12;
    const attack = o.attack ?? 0.004;
    const release = o.release ?? dur;
    const peak = o.gain ?? 0.15;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = o.filter ?? "highpass";
    filter.frequency.setValueAtTime(o.freq ?? 2000, t0);
    if (o.sweepTo) filter.frequency.exponentialRampToValueAtTime(Math.max(20, o.sweepTo), t0 + dur);
    if (o.q != null) filter.Q.value = o.q;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + release);

    src.connect(filter).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + attack + release + 0.02);
  }

  /** Throttled dispatch guard used by the manifest. Returns false if suppressed. */
  gate(key: string, minGapMs = 0): boolean {
    if (!this.live) return false;
    if (minGapMs > 0 && !this.allow(key, minGapMs)) return false;
    return true;
  }
}

/** The process-wide singleton. Import this everywhere. */
export const engine = new SoundEngine();
