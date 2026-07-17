// The ProofBall sonic palette.
//
// Each entry is a recipe that schedules a short cluster of struck-object voices
// on the engine. One instrument, three materials: ratio 1 = warm wood (tactile
// cues), 2 = clean octave bell (rewards), 3/3.5 = glass sparkle (coin/copy/
// welcome shimmer), 1.41 = inharmonic metal (the lone tension colour, red card).
// Everything is pitched to the A-minor-pentatonic table in engine.ts so overlaps
// stay consonant, everything is struck (never faded-in) and humanized per trigger
// so no two hits are identical, and it all sits in one short room. Volumes are
// deliberately low — UI sound is seasoning, not a soundtrack.

import { engine, NOTES, SCALE_UP } from "./engine";

export type SoundName =
  | "pickUp"
  | "pickDown"
  | "lock"
  | "open"
  | "tickWarn"
  | "win"
  | "lose"
  | "coin"
  | "streakUp"
  | "best"
  | "welcome"
  | "goal"
  | "redCard"
  | "rankUp"
  | "milestone"
  | "navTap"
  | "theme"
  | "press"
  | "copy"
  | "toggle";

export interface PlayOpts {
  /** Streak / rank level — climbs the pentatonic scale for win + streakUp. */
  level?: number;
  /** "up" | "down" for direction-tinted sounds (theme). */
  dir?: "up" | "down";
  /** A larger event (a broken big streak on a loss). */
  big?: boolean;
}

/** Pick the scale note for a level, clamped into the table. */
function scaleNote(level: number): number {
  const i = Math.max(0, Math.min(SCALE_UP.length - 1, level));
  return SCALE_UP[i];
}

const RECIPES: Record<SoundName, (o: PlayOpts) => void> = {
  // --- gesture / tactile: tiny wooden taps, contact-forward, near-subliminal, dry ---
  press: () => {
    engine.fm({ freq: NOTES.A4, dur: 0.06, gain: 0.05, ratio: 1, index: 1.6, indexDecay: 0.03, blip: 12, blipTime: 0.01, contact: 0.5, lowpass: 5000, attack: 0.002, wet: 0.04 });
  },
  navTap: () => {
    // The quietest cue in the app — a wooden tick, contact over a whisper of body.
    engine.fm({ freq: NOTES.D4, dur: 0.045, gain: 0.04, ratio: 1, index: 1.2, indexDecay: 0.022, blip: 10, blipTime: 0.009, contact: 0.6, lowpass: 4200, attack: 0.002, wet: 0 });
  },
  toggle: () => {
    engine.fm({ freq: NOTES.E4, dur: 0.07, gain: 0.06, ratio: 1, index: 1.6, indexDecay: 0.03, blip: 10, contact: 0.35, wet: 0.06, pan: -0.08 });
    engine.fm({ freq: NOTES.G4, when: 0.05, dur: 0.09, gain: 0.055, ratio: 1, index: 1.8, indexDecay: 0.035, blip: 10, contact: 0.3, wet: 0.07, pan: 0.08 });
  },
  copy: () => {
    // "Copied" — two glassy bells up, a breath of high air.
    engine.fm({ freq: NOTES.E5, dur: 0.16, gain: 0.085, ratio: 3, index: 2.2, indexDecay: 0.08, blip: 8, wet: 0.13, pan: -0.1 });
    engine.fm({ freq: NOTES.A5, when: 0.055, dur: 0.2, gain: 0.075, ratio: 3, index: 2.0, indexDecay: 0.1, blip: 8, wet: 0.15, pan: 0.1 });
    engine.transient({ when: 0.05, dur: 0.11, gain: 0.028, filter: "highpass", freq: 6500, sweepTo: 9000, wet: 0.12 });
  },

  // Direction call: mirrored wooden-bell plucks (up = E4->A4, down = A4->E4) + air.
  pickUp: () => {
    engine.fm({ freq: NOTES.E4, dur: 0.12, gain: 0.12, ratio: 2, index: 2.2, indexDecay: 0.06, blip: 18, blipTime: 0.016, contact: 0.35, wet: 0.09, pan: -0.12 });
    engine.fm({ freq: NOTES.A4, when: 0.05, dur: 0.17, gain: 0.12, ratio: 2, index: 2.1, indexDecay: 0.065, blip: 14, contact: 0.3, wet: 0.11, pan: 0.12 });
    engine.transient({ dur: 0.04, gain: 0.03, filter: "highpass", freq: 4200, attack: 0.002, wet: 0.06 });
  },
  pickDown: () => {
    engine.fm({ freq: NOTES.A4, dur: 0.12, gain: 0.12, ratio: 2, index: 2.2, indexDecay: 0.06, blip: 18, blipTime: 0.016, contact: 0.35, wet: 0.09, pan: 0.12 });
    engine.fm({ freq: NOTES.E4, when: 0.05, dur: 0.17, gain: 0.12, ratio: 2, index: 2.1, indexDecay: 0.065, blip: 14, contact: 0.3, wet: 0.11, pan: -0.12 });
    engine.transient({ dur: 0.04, gain: 0.03, filter: "highpass", freq: 4200, attack: 0.002, wet: 0.06 });
  },

  // Committing on-chain: a confident low wooden "seat" (body + sub + contact) + a mid confirm.
  lock: () => {
    engine.fm({ freq: NOTES.A2, dur: 0.24, gain: 0.16, ratio: 1, index: 2.2, indexDecay: 0.05, blip: 30, blipTime: 0.02, contact: 0.5, sub: 0.45, partial: 4, partialGain: 0.22, lowpass: 1400, wet: 0.1 });
    engine.fm({ freq: NOTES.A3, when: 0.02, dur: 0.12, gain: 0.075, ratio: 1, index: 1.4, indexDecay: 0.04, contact: 0.2, wet: 0.09 });
  },

  // Market opening: one featherweight "ready" bell + a fifth of shimmer. Fires often -> quiet.
  open: () => {
    engine.fm({ freq: NOTES.C4, dur: 0.14, gain: 0.055, ratio: 2, index: 1.8, indexDecay: 0.12, blip: 8, wet: 0.16, pan: -0.06 });
    engine.fm({ freq: NOTES.G4, when: 0.06, dur: 0.18, gain: 0.045, ratio: 2, index: 1.8, indexDecay: 0.14, blip: 8, wet: 0.18, pan: 0.06 });
  },

  // Final-3s urgency: a dry wooden "tok", rising A4/C5/E5 with the level. No square.
  tickWarn: ({ level = 0 }) => {
    const f = [NOTES.A4, NOTES.C5, NOTES.E5][Math.min(2, level)] ?? NOTES.A4;
    engine.fm({ freq: f, dur: 0.06, gain: 0.06, ratio: 1, index: 3.0, indexDecay: 0.016, blip: 16, blipTime: 0.009, contact: 0.7, lowpass: 5500, attack: 0.002, wet: 0.03 });
  },

  // --- rewards / outcomes ---
  // Correct call: a warm bell arpeggio rolled root->third->fifth, climbing a step
  // per streak level, a mono sub under the root, spread L->R, a kiss of air.
  win: ({ level = 0 }) => {
    const root = scaleNote(Math.min(level, 5));
    const third = scaleNote(Math.min(level + 2, SCALE_UP.length - 1));
    const fifth = scaleNote(Math.min(level + 4, SCALE_UP.length - 1));
    engine.fm({ freq: root, dur: 0.3, gain: 0.12, ratio: 2, index: 2.8, indexDecay: 0.12, blip: 12, contact: 0.2, sub: 0.4, wet: 0.18, pan: -0.12 });
    engine.fm({ freq: third, when: 0.075, dur: 0.34, gain: 0.11, ratio: 2, index: 2.8, indexDecay: 0.13, blip: 12, contact: 0.18, wet: 0.2, pan: 0.02 });
    engine.fm({ freq: fifth, when: 0.15, dur: 0.44, gain: 0.11, ratio: 2, index: 2.9, indexDecay: 0.14, blip: 12, contact: 0.18, wet: 0.24, pan: 0.14 });
    engine.transient({ when: 0.15, dur: 0.14, gain: 0.03, filter: "highpass", freq: 6000, sweepTo: 10000, wet: 0.18 });
  },

  // Coin: a glassy inharmonic cascade panned L->R — struck glass tumbling, not a square.
  coin: () => {
    const notes = [NOTES.C5, NOTES.E5, NOTES.A5, NOTES.C6];
    const pans = [-0.2, -0.02, 0.14, 0.28];
    notes.forEach((f, i) =>
      engine.fm({ freq: f, when: i * 0.035, dur: 0.14, gain: 0.055 - i * 0.004, ratio: 3, index: 2.0 - i * 0.2, indexDecay: 0.06, blip: 8, attack: 0.002, wet: 0.16, pan: pans[i] }),
    );
  },

  // Incorrect call: soft, non-punishing — a warm low bell settling D3->A2, sub for
  // body. A bigger low breath only if a real streak broke.
  lose: ({ big = false }) => {
    engine.fm({ freq: NOTES.D3, dur: 0.34, gain: 0.11, ratio: 1, index: 1.5, indexDecay: 0.1, glideTo: NOTES.A2, contact: 0.15, sub: 0.35, lowpass: 1300, wet: 0.14 });
    if (big) engine.transient({ dur: 0.32, gain: 0.045, filter: "lowpass", freq: 1200, sweepTo: 320, attack: 0.02, wet: 0.12 });
  },

  // Streak +1: a single gliding bell blip, pitch = level, up a step. (Fires ~130ms after win.)
  streakUp: ({ level = 1 }) => {
    engine.fm({ freq: scaleNote(level), dur: 0.16, gain: 0.1, ratio: 2, index: 2.6, indexDecay: 0.08, blip: 10, glideTo: scaleNote(level + 1), contact: 0.2, wet: 0.13, pan: 0.08 });
  },

  // New personal best: a slow, resolved 4-bell bloom across the field, warm sub,
  // long tail, a whisper of air. Rare -> allowed to breathe. (Fires ~280ms after win.)
  best: () => {
    const seq = [NOTES.A4, NOTES.C5, NOTES.E5, NOTES.A5];
    const pans = [-0.22, -0.07, 0.08, 0.22];
    seq.forEach((f, i) =>
      engine.fm({ freq: f, when: i * 0.07, dur: 0.52 - i * 0.03, gain: 0.11, ratio: 2, index: 3.0, indexDecay: 0.16, blip: 10, contact: 0.16, sub: i === 0 ? 0.35 : 0, partial: i === 3 ? 4 : undefined, partialGain: 0.16, wet: 0.24, pan: pans[i] }),
    );
    engine.transient({ dur: 0.4, gain: 0.028, filter: "highpass", freq: 6500, sweepTo: 9500, wet: 0.22 });
  },

  // First-connect airdrop: the richest cue — a rising pentatonic bell run, a glassy
  // sparkle cascade above, and a warm two-voice pad bed underneath, all in the room.
  welcome: () => {
    const run = [NOTES.A3, NOTES.C4, NOTES.D4, NOTES.E4, NOTES.G4, NOTES.A4, NOTES.C5];
    run.forEach((f, i) =>
      engine.fm({ freq: f, when: i * 0.055, dur: 0.3, gain: 0.078, ratio: 2, index: 2.6, indexDecay: 0.12, blip: 8, contact: 0.15, sub: i === 0 ? 0.3 : 0, wet: 0.2, pan: -0.28 + i * 0.09 }),
    );
    const spark = [NOTES.C6, NOTES.E6, NOTES.A5];
    for (let i = 0; i < 5; i++) {
      engine.fm({ freq: spark[i % 3], when: 0.16 + i * 0.07, dur: 0.16, gain: 0.04, ratio: 3.5, index: 1.8, indexDecay: 0.07, blip: 6, wet: 0.22, pan: i % 2 ? 0.2 : -0.2 });
    }
    // Warm pad bed (reuses the existing detuned sine tone()).
    engine.tone({ freq: NOTES.A3, when: 0.05, dur: 0.7, type: "sine", gain: 0.05, attack: 0.06, release: 0.6, detune: 8, lowpass: 2000 });
    engine.tone({ freq: NOTES.E4, when: 0.05, dur: 0.7, type: "sine", gain: 0.045, attack: 0.06, release: 0.6, detune: -8, lowpass: 2200 });
  },

  // --- match events ---
  // Goal: a warm stadium swell — a rising bandpass roar, a struck low wood body with
  // sub gliding up, and a bright bell accent, plus a sparkle top.
  goal: () => {
    engine.transient({ dur: 0.5, gain: 0.1, filter: "bandpass", freq: 500, sweepTo: 1600, q: 0.7, attack: 0.08, wet: 0.16 });
    engine.fm({ freq: NOTES.A2, dur: 0.3, gain: 0.15, ratio: 1, index: 2.2, indexDecay: 0.06, blip: 20, contact: 0.4, sub: 0.5, glideTo: NOTES.C3, lowpass: 900, wet: 0.12 });
    engine.fm({ freq: NOTES.A4, when: 0.16, dur: 0.32, gain: 0.09, ratio: 2, index: 2.6, indexDecay: 0.14, blip: 12, contact: 0.2, wet: 0.2, pan: 0.1 });
    engine.fm({ freq: NOTES.E5, when: 0.24, dur: 0.34, gain: 0.075, ratio: 2, index: 2.6, indexDecay: 0.15, blip: 12, wet: 0.22, pan: -0.1 });
    engine.transient({ when: 0.2, dur: 0.3, gain: 0.03, filter: "highpass", freq: 6000, sweepTo: 11000, wet: 0.16 });
  },
  // Red card: the lone inharmonic metal color — a tense 1.41:1 thud sinking below A2,
  // with a muffled low noise fall. Ominous, spacious, never harsh.
  redCard: () => {
    engine.fm({ freq: NOTES.A2, dur: 0.36, gain: 0.11, ratio: 1.41, index: 3.5, indexDecay: 0.22, blip: 40, blipTime: 0.03, glideTo: NOTES.A2 * 0.92, contact: 0.35, sub: 0.4, lowpass: 700, wet: 0.18 });
    engine.transient({ dur: 0.34, gain: 0.05, filter: "lowpass", freq: 1000, sweepTo: 220, attack: 0.02, wet: 0.14 });
  },

  // --- leaderboard ---
  // Climbed a spot: an airy rise into two glassy-ish bell dings.
  rankUp: () => {
    engine.transient({ dur: 0.2, gain: 0.05, filter: "highpass", freq: 900, sweepTo: 5500, attack: 0.01, wet: 0.14, pan: 0.05 });
    engine.fm({ freq: NOTES.E5, when: 0.1, dur: 0.2, gain: 0.1, ratio: 2, index: 2.6, indexDecay: 0.12, blip: 12, contact: 0.18, wet: 0.16, pan: 0.12 });
    engine.fm({ freq: NOTES.A5, when: 0.16, dur: 0.22, gain: 0.08, ratio: 2, index: 2.4, indexDecay: 0.12, blip: 12, wet: 0.18, pan: -0.1 });
  },
  // Genuine milestone (top-3 entry): a bigger, brighter, airier bell bloom than a plain win.
  milestone: () => {
    const seq = [NOTES.A4, NOTES.E5, NOTES.A5, NOTES.C6];
    const pans = [-0.24, -0.05, 0.16, 0.28];
    seq.forEach((f, i) =>
      engine.fm({ freq: f, when: i * 0.06, dur: 0.5 - i * 0.035, gain: 0.11, ratio: 2, index: 3.2, indexDecay: 0.16, blip: 12, contact: 0.16, sub: i === 0 ? 0.3 : 0, wet: 0.24, pan: pans[i] }),
    );
    engine.transient({ dur: 0.42, gain: 0.03, filter: "highpass", freq: 6000, sweepTo: 11000, wet: 0.22 });
  },

  // Theme flip: an airy bandpass swish (up->light / down->dark) + a soft bell glide.
  theme: ({ dir = "up" }) => {
    const up = dir === "up";
    engine.transient({ dur: 0.22, gain: 0.05, filter: "bandpass", freq: up ? 1200 : 3000, sweepTo: up ? 4200 : 800, q: 0.8, wet: 0.16 });
    engine.fm({ freq: up ? NOTES.C4 : NOTES.C5, dur: 0.16, gain: 0.055, ratio: 2, index: 1.8, indexDecay: 0.13, blip: 6, glideTo: up ? NOTES.G4 : NOTES.G3, wet: 0.16, pan: up ? 0.12 : -0.12 });
  },
};

/** Minimum wall-clock gap (ms) between repeats of the same sound. */
const THROTTLE: Partial<Record<SoundName, number>> = {
  navTap: 40,
  press: 40,
  tickWarn: 250,
  pickUp: 60,
  pickDown: 60,
  open: 400,
  coin: 40,
  rankUp: 1500,
  milestone: 1500,
  goal: 300,
};

/** Play a sound by name. No-ops silently when muted / locked / suppressed.
 *  Never throws: sound is cosmetic and must not be able to break the click
 *  handler it is called from (e.g. wallet select, a pick, nav). */
export function playSound(name: SoundName, opts: PlayOpts = {}): void {
  try {
    if (!engine.gate(name, THROTTLE[name] ?? 0)) return;
    const recipe = RECIPES[name];
    if (recipe) recipe(opts);
  } catch {
    /* audio is best-effort; swallow any Web Audio hiccup */
  }
}
