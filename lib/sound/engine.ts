// ProofBall sound engine.
//
// A zero-asset Web Audio synth. Every sound the app makes is generated
// procedurally here, so there are no audio files to ship, load, or license, and
// the whole palette retunes from code.
//
// The voice is one struck-object family: a sine-carrier FM voice (fm()) whose
// modulation index collapses fast — bright on the strike, pure in the tail, the
// way a real marimba/kalimba/bell rings — plus a filtered-noise transient()
// for contact/air/crowd. Every trigger is humanized (pitch, timing, gain, pan)
// so no two hits are byte-identical, everything sits in one short procedural
// room, and the bus is warmed by a gentle tanh saturator. Think "warm wood +
// clean bell, in one room": subtle confirms and a light reward layer, all
// pitched to one pentatonic scale so overlapping sounds never clash.
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

export interface FMOpts {
  /** Carrier frequency in Hz. */
  freq: number;
  when?: number;
  /** Total voiced time; amp exp-decays from peak to the 0.0001 floor over this. Default 0.3. */
  dur?: number;
  /** Peak gain 0..1, pre-master (before ±12% humanization). Default 0.14. */
  gain?: number;
  /** Amp attack, seconds (clamped >= 0.0015 to stay click-free). Default 0.004. */
  attack?: number;
  /** Modulator:carrier ratio. 1 = wood/mallet, 2 = clean octave bell,
   *  3 / 3.5 = glass sparkle, 1.41 (~sqrt2) = inharmonic metal. Default 1. */
  ratio?: number;
  /** Peak FM index (the strike "bite"); FM depth Hz = index * modFreq. 0 = pure sine. */
  index?: number;
  /** Seconds for the index to collapse toward silence (bite -> pure body). Default dur*0.35. */
  indexDecay?: number;
  /** Attack pitch-blip in cents: note starts this far ABOVE freq and exp-glides
   *  down over blipTime (the struck "thock"). Default 0 (off). */
  blip?: number;
  /** Seconds for the pitch-blip to settle. Default 0.014. */
  blipTime?: number;
  /** Whole-note pitch glide target in Hz (for falls/rises). */
  glideTo?: number;
  /** Optional extra additive sine at freq*partial, decaying twice as fast (struck realism). */
  partial?: number;
  /** Relative gain of that partial vs the body. Default 0.3. */
  partialGain?: number;
  /** Mallet contact-transient level 0..1 (short bandpass-noise knock, stays dry). */
  contact?: number;
  /** Sub-octave sine body gain, relative to peak (0..1). Centered/mono for weight. */
  sub?: number;
  /** Optional lowpass on the carrier (Hz) for extra roundness. */
  lowpass?: number;
  /** Base stereo pan -1..1 (humanization adds ±0.08). */
  pan?: number;
  /** Reverb send 0..1. Default 0 (dry). */
  wet?: number;
  /** Carrier waveform; keep "sine" for this palette. */
  carrierType?: OscillatorType;
  /** Set false to disable per-trigger humanization (rarely needed). */
  humanize?: boolean;
}

export interface TransOpts {
  when?: number;
  dur?: number;
  gain?: number;
  attack?: number;
  filter?: BiquadFilterType;
  freq?: number;
  sweepTo?: number;
  q?: number;
  pan?: number;
  wet?: number;
}

const LS_KEY = "pb:muted";

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private reverbBus: GainNode | null = null; // per-voice wet sends feed this
  private sat: WaveShaperNode | null = null; // bus warmth (tanh glue)
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
      const bus = this.buildBus(this.ctx, this._muted ? 0 : this._volume);
      this.master = bus.master;
      this.reverbBus = bus.reverbBus;
      this.sat = bus.sat;
      this.noiseBuffer = this.buildNoise(this.ctx);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    this.unlocked = true;
  }

  /** Build the shared output bus for a context: master -> tanh warmth -> limiter
   *  -> destination, plus a short procedural room summed back into master. Used
   *  live by unlock() and offline by renderOffline(), so the graph never drifts. */
  private buildBus(ctx: BaseAudioContext, masterGain: number): { master: GainNode; reverbBus: GainNode; sat: WaveShaperNode } {
    const master = ctx.createGain();
    master.gain.value = masterGain;

    // Warmth: a gentle normalized tanh glue rounds loud reward peaks and is
    // essentially unity for quiet tactile cues. Sits master -> sat -> comp.
    const sat = ctx.createWaveShaper();
    sat.curve = this.makeSatCurve(1.4);
    sat.oversample = "2x";

    // A gentle limiter keeps layered sounds from ever clipping.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 24;
    comp.ratio.value = 12;
    comp.attack.value = 0.003;
    comp.release.value = 0.18;
    master.connect(sat).connect(comp).connect(ctx.destination);

    // Space: one short, dark, warm room. Voices send here via route(); the
    // return folds back into master (so the wet is saturated + limited too).
    const reverbBus = ctx.createGain();
    reverbBus.gain.value = 1;
    const conv = ctx.createConvolver();
    conv.buffer = this.makeImpulse(ctx, 0.6, 2.8);
    const reverbReturn = ctx.createGain();
    reverbReturn.gain.value = 0.85;
    reverbBus.connect(conv).connect(reverbReturn).connect(master);

    return { master, reverbBus, sat };
  }

  private buildNoise(ctx: BaseAudioContext | null = this.ctx): AudioBuffer | null {
    if (!ctx) return null;
    const len = Math.floor(ctx.sampleRate * 0.6);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** Normalized soft tanh transfer curve (unity at |x|=1 so it never drops level):
   *  near-linear for quiet cues, gently rounds loud reward peaks + adds warmth. */
  private makeSatCurve(k: number): Float32Array {
    const n = 1024;
    const curve = new Float32Array(n);
    const norm = Math.tanh(k);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(k * x) / norm;
    }
    return curve;
  }

  /** A short, dark, WARM room impulse: decaying stereo-decorrelated noise, one-pole
   *  low-passed (non-grainy), 5ms fade-in (no wet-onset click), reaching 0 at the
   *  end (no tail click), pre-scaled so the wet return stays "seasoning". */
  private makeImpulse(ctx: BaseAudioContext, seconds: number, power: number): AudioBuffer {
    const rate = ctx.sampleRate;
    const len = Math.max(1, Math.floor(rate * seconds));
    const buf = ctx.createBuffer(2, len, rate);
    const fade = Math.max(1, rate * 0.005);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      let lp = 0;
      const coef = 0.4; // ~2.8kHz corner @44.1k => warm/airy tail, not bright fizz
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        lp += coef * (white - lp);
        const env = Math.pow(1 - i / len, power);
        const ramp = Math.min(1, i / fade);
        data[i] = lp * env * ramp * 0.6;
      }
    }
    return buf;
  }

  /** Per-trigger humanization — small random offsets so repeats are never identical. */
  private hum(): { cents: number; dt: number; gm: number; pan: number } {
    const r = () => Math.random() * 2 - 1;
    return { cents: r() * 5, dt: r() * 0.003, gm: 1 + r() * 0.12, pan: r() * 0.08 };
  }

  /** Route a voice's amp output to the dry master (via a StereoPanner when panned)
   *  and, optionally, to the reverb send. Mono-safe: pans stay modest, sub stays dry+centered. */
  private route(input: AudioNode, pan: number, wet: number): void {
    if (!this.ctx || !this.master) return;
    let out: AudioNode = input;
    if (pan !== 0 && typeof this.ctx.createStereoPanner === "function") {
      const p = this.ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      input.connect(p);
      out = p;
    }
    out.connect(this.master);
    if (wet > 0 && this.reverbBus) {
      const s = this.ctx.createGain();
      s.gain.value = Math.min(1, wet);
      out.connect(s).connect(this.reverbBus);
    }
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

  /** The core organic voice: an FM-struck wood/bell/glass object.
   *  FM bends frequency, not amplitude, so peak == the amp-envelope peak (no hidden clip). */
  fm(o: FMOpts): void {
    if (!this.live || !this.ctx || !this.master) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const H = o.humanize === false ? { cents: 0, dt: 0, gm: 1, pan: 0 } : this.hum();

    const attack = Math.max(0.0015, o.attack ?? 0.004);
    const dur = Math.max(attack + 0.02, o.dur ?? 0.3);
    const freq = o.freq * Math.pow(2, H.cents / 1200);
    const peak = Math.max(0.0002, (o.gain ?? 0.14) * H.gm);
    const ratio = o.ratio ?? 1;
    const index = o.index ?? 0;
    const idxDecay = Math.max(0.008, o.indexDecay ?? dur * 0.35);
    const blip = o.blip ?? 0;
    const blipTime = o.blipTime ?? 0.014;
    const pan = (o.pan ?? 0) + H.pan;
    const wet = o.wet ?? 0;

    let t0 = now + (o.when ?? 0) + H.dt;
    if (t0 < now) t0 = now;
    const stop = t0 + dur + 0.05;

    // --- carrier (with optional attack pitch-blip, then optional whole-note glide) ---
    const car = ctx.createOscillator();
    car.type = o.carrierType ?? "sine";
    if (blip > 0) {
      car.frequency.setValueAtTime(freq * Math.pow(2, blip / 1200), t0);
      car.frequency.exponentialRampToValueAtTime(freq, t0 + blipTime);
    } else {
      car.frequency.setValueAtTime(freq, t0);
    }
    if (o.glideTo) {
      car.frequency.exponentialRampToValueAtTime(Math.max(1, o.glideTo * Math.pow(2, H.cents / 1200)), t0 + dur);
    }

    // --- FM modulator with a fast-collapsing index (bright strike -> pure tail) ---
    if (index > 0) {
      const mod = ctx.createOscillator();
      mod.type = "sine";
      const modFreq = freq * ratio;
      mod.frequency.setValueAtTime(modFreq, t0);
      const depth = index * modFreq;
      const mg = ctx.createGain();
      mg.gain.setValueAtTime(depth, t0);
      mg.gain.exponentialRampToValueAtTime(Math.max(0.0001, depth * 0.02), t0 + idxDecay);
      mod.connect(mg).connect(car.frequency);
      mod.start(t0);
      mod.stop(stop);
    }

    // --- amp envelope (single exponential decay to the floor) ---
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    let head: AudioNode = car;
    if (o.lowpass) {
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = o.lowpass;
      car.connect(lp);
      head = lp;
    }
    head.connect(amp);
    this.route(amp, pan, wet);
    car.start(t0);
    car.stop(stop);

    // --- optional additive partial (independent, decays 2x faster => struck realism) ---
    if (o.partial) {
      const p = ctx.createOscillator();
      p.type = "sine";
      const pf = freq * o.partial;
      if (blip > 0) {
        p.frequency.setValueAtTime(pf * Math.pow(2, blip / 1200), t0);
        p.frequency.exponentialRampToValueAtTime(pf, t0 + blipTime);
      } else {
        p.frequency.setValueAtTime(pf, t0);
      }
      const pg = ctx.createGain();
      pg.gain.setValueAtTime(0.0001, t0);
      pg.gain.exponentialRampToValueAtTime(peak * (o.partialGain ?? 0.3), t0 + attack);
      pg.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * 0.5);
      p.connect(pg);
      this.route(pg, pan, wet * 0.6);
      p.start(t0);
      p.stop(stop);
    }

    // --- sub-octave body (centered/mono for weight without mud) ---
    if (o.sub && o.sub > 0) {
      const sub = ctx.createOscillator();
      sub.type = "sine";
      sub.frequency.setValueAtTime(freq / 2, t0);
      if (o.glideTo) sub.frequency.exponentialRampToValueAtTime(Math.max(1, o.glideTo / 2), t0 + dur);
      const sg = ctx.createGain();
      sg.gain.setValueAtTime(0.0001, t0);
      sg.gain.exponentialRampToValueAtTime(peak * o.sub, t0 + Math.max(attack, 0.006));
      sg.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      sub.connect(sg).connect(this.master); // dry + centered
      sub.start(t0);
      sub.stop(stop);
    }

    // --- mallet contact transient (the knock; stays dry so the attack reads tight) ---
    if ((o.contact ?? 0) > 0 && this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = Math.min(6000, Math.max(1500, freq * 4));
      bp.Q.value = 0.8;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.0001, t0);
      ng.gain.exponentialRampToValueAtTime((o.contact as number) * peak, t0 + 0.0015);
      ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.014);
      src.connect(bp).connect(ng);
      this.route(ng, pan, 0);
      src.start(t0);
      src.stop(t0 + 0.03);
    }
  }

  /** A burst of filtered noise — ticks, swishes, thumps, crowd texture (dry, mono). */
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

  /** Filtered-noise contact / air / crowd burst — panned, with an optional reverb send.
   *  (Adds stereo + wet over the dry-mono noise(); use noise() when neither is needed.) */
  transient(o: TransOpts): void {
    if (!this.live || !this.ctx || !this.master || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + Math.max(0, o.when ?? 0);
    const attack = Math.max(0.0015, o.attack ?? 0.003);
    const dur = Math.max(attack + 0.01, o.dur ?? 0.05);
    const peak = o.gain ?? 0.05;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = o.filter ?? "bandpass";
    filt.frequency.setValueAtTime(o.freq ?? 2000, t0);
    if (o.sweepTo) filt.frequency.exponentialRampToValueAtTime(Math.max(40, o.sweepTo), t0 + dur);
    if (o.q != null) filt.Q.value = o.q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt).connect(g);
    this.route(g, o.pan ?? 0, o.wet ?? 0);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  /** Throttled dispatch guard used by the manifest. Returns false if suppressed. */
  gate(key: string, minGapMs = 0): boolean {
    if (!this.live) return false;
    if (minGapMs > 0 && !this.allow(key, minGapMs)) return false;
    return true;
  }

  /** Render a cue (or any function that calls the voices) to an offline buffer,
   *  through the exact live bus. Used by the waveform-verification harness — the
   *  engine temporarily points at an OfflineAudioContext, then restores. */
  async renderOffline(play: () => void, seconds = 1.6): Promise<AudioBuffer | null> {
    if (typeof window === "undefined") return null;
    const Ctor =
      window.OfflineAudioContext ||
      (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
    if (!Ctor) return null;
    const rate = 48000;
    const octx = new Ctor(2, Math.max(1, Math.ceil(rate * seconds)), rate);

    const saved = {
      ctx: this.ctx,
      master: this.master,
      reverbBus: this.reverbBus,
      sat: this.sat,
      noiseBuffer: this.noiseBuffer,
      unlocked: this.unlocked,
      muted: this._muted,
    };

    const bus = this.buildBus(octx, this._volume);
    this.ctx = octx as unknown as AudioContext;
    this.master = bus.master;
    this.reverbBus = bus.reverbBus;
    this.sat = bus.sat;
    this.noiseBuffer = this.buildNoise(octx);
    this.unlocked = true;
    this._muted = false;

    let buf: AudioBuffer | null = null;
    try {
      play();
      buf = await octx.startRendering();
    } catch {
      buf = null;
    } finally {
      this.ctx = saved.ctx;
      this.master = saved.master;
      this.reverbBus = saved.reverbBus;
      this.sat = saved.sat;
      this.noiseBuffer = saved.noiseBuffer;
      this.unlocked = saved.unlocked;
      this._muted = saved.muted;
    }
    return buf;
  }
}

/** The process-wide singleton. Import this everywhere. */
export const engine = new SoundEngine();
