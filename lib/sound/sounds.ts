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
  // --- gesture / tactile (fire per interaction, so kept subliminal) ---
  press: () => {
    engine.tone({ freq: NOTES.A4, dur: 0.05, type: "sine", gain: 0.09, attack: 0.002, release: 0.05, lowpass: 1800 });
  },
  navTap: () => {
    // A muted, almost-subliminal wooden tick. High frequency of use → very quiet.
    engine.noise({ dur: 0.03, gain: 0.045, filter: "bandpass", freq: 1400, q: 1.2, release: 0.03 });
    engine.tone({ freq: NOTES.D4, dur: 0.04, type: "sine", gain: 0.05, release: 0.04 });
  },
  toggle: () => {
    engine.tone({ freq: NOTES.E4, dur: 0.06, type: "triangle", gain: 0.08, release: 0.06, glideTo: NOTES.G4 });
  },
  copy: () => {
    engine.tone({ freq: NOTES.E5, dur: 0.08, type: "sine", gain: 0.1, release: 0.08 });
    engine.tone({ freq: NOTES.A5, when: 0.05, dur: 0.09, type: "sine", gain: 0.08, release: 0.09 });
  },

  // Rising call: bright two-note up. Falling call: two-note down. Same shape,
  // mirrored, so the direction is audible before you look.
  pickUp: () => {
    engine.tone({ freq: NOTES.E4, dur: 0.07, type: "triangle", gain: 0.13, release: 0.07 });
    engine.tone({ freq: NOTES.A4, when: 0.045, dur: 0.1, type: "triangle", gain: 0.13, release: 0.1 });
    engine.noise({ when: 0, dur: 0.05, gain: 0.05, filter: "highpass", freq: 3000, release: 0.05 });
  },
  pickDown: () => {
    engine.tone({ freq: NOTES.A4, dur: 0.07, type: "triangle", gain: 0.13, release: 0.07 });
    engine.tone({ freq: NOTES.E4, when: 0.045, dur: 0.1, type: "triangle", gain: 0.13, release: 0.1 });
    engine.noise({ when: 0, dur: 0.05, gain: 0.05, filter: "highpass", freq: 3000, release: 0.05 });
  },

  // Committing on-chain: a soft mechanical latch — low body + a filtered click.
  lock: () => {
    engine.tone({ freq: NOTES.A2, dur: 0.1, type: "sine", gain: 0.16, attack: 0.002, release: 0.1, lowpass: 500 });
    engine.noise({ dur: 0.05, gain: 0.09, filter: "lowpass", freq: 2200, q: 3, release: 0.05 });
    engine.tone({ freq: NOTES.A3, when: 0.02, dur: 0.06, type: "sine", gain: 0.07, release: 0.06 });
  },

  // A market opening: a soft "ready" bell. Fires often, so featherweight.
  open: () => {
    engine.tone({ freq: NOTES.C4, dur: 0.09, type: "sine", gain: 0.06, release: 0.09 });
    engine.tone({ freq: NOTES.G4, when: 0.06, dur: 0.11, type: "sine", gain: 0.05, release: 0.11 });
  },

  // Final-3s urgency: one dry tick, rising a touch with the level (0,1,2).
  tickWarn: ({ level = 0 }) => {
    const f = [NOTES.A4, NOTES.C5, NOTES.E5][Math.min(2, level)] ?? NOTES.A4;
    engine.tone({ freq: f, dur: 0.04, type: "square", gain: 0.06, release: 0.04, lowpass: 3000 });
  },

  // --- rewards / outcomes ---
  // Correct call: a bright triad that climbs a step for each streak level, plus
  // a little air. Higher streak → literally higher-pitched win.
  win: ({ level = 0 }) => {
    const root = scaleNote(Math.min(level, 5)); // don't run off the top on routine wins
    const third = scaleNote(Math.min(level + 2, SCALE_UP.length - 1));
    const fifth = scaleNote(Math.min(level + 4, SCALE_UP.length - 1));
    engine.tone({ freq: root, dur: 0.12, type: "triangle", gain: 0.14, release: 0.12 });
    engine.tone({ freq: third, when: 0.07, dur: 0.13, type: "triangle", gain: 0.13, release: 0.13 });
    engine.tone({ freq: fifth, when: 0.14, dur: 0.24, type: "triangle", gain: 0.14, release: 0.22, detune: 6 });
    engine.noise({ when: 0.14, dur: 0.12, gain: 0.04, filter: "highpass", freq: 5000, release: 0.12 });
  },

  // Coin: the classic quick two-note "ding" — pairs with the count-up.
  coin: () => {
    engine.tone({ freq: NOTES.C6, dur: 0.05, type: "square", gain: 0.08, release: 0.05, lowpass: 4000 });
    engine.tone({ freq: NOTES.E6, when: 0.04, dur: 0.12, type: "square", gain: 0.08, release: 0.12, lowpass: 4500 });
  },

  // Incorrect call: soft, non-punishing. A gentle low fall; a bit more air only
  // if a big streak actually broke.
  lose: ({ big = false }) => {
    engine.tone({ freq: NOTES.D3, dur: 0.16, type: "sine", gain: 0.12, release: 0.16, glideTo: NOTES.A2, lowpass: 900 });
    if (big) engine.noise({ dur: 0.28, gain: 0.05, filter: "lowpass", freq: 1200, sweepTo: 300, release: 0.28 });
  },

  // Streak ticked up a level: a single ascending blip, pitch = level.
  streakUp: ({ level = 1 }) => {
    engine.tone({ freq: scaleNote(level), dur: 0.09, type: "triangle", gain: 0.11, release: 0.09, glideTo: scaleNote(level + 1) });
  },

  // New personal best: a resolved, warmer chord — rarer than a plain win.
  best: () => {
    const seq = [NOTES.A4, NOTES.C5, NOTES.E5, NOTES.A5];
    seq.forEach((f, i) =>
      engine.tone({ freq: f, when: i * 0.06, dur: 0.34 - i * 0.03, type: "triangle", gain: 0.13, release: 0.3, detune: 5 }),
    );
    engine.noise({ when: 0, dur: 0.3, gain: 0.04, filter: "highpass", freq: 6000, sweepTo: 9000, release: 0.3 });
  },

  // First-connect airdrop: the richest cue in the app — a coin cascade under a
  // rising pentatonic run and a soft pad.
  welcome: () => {
    const run = [NOTES.A3, NOTES.C4, NOTES.D4, NOTES.E4, NOTES.G4, NOTES.A4, NOTES.C5];
    run.forEach((f, i) =>
      engine.tone({ freq: f, when: i * 0.05, dur: 0.18, type: "triangle", gain: 0.1, release: 0.16 }),
    );
    // coin shower
    for (let i = 0; i < 5; i++) {
      const f = [NOTES.C6, NOTES.E6, NOTES.A5][i % 3];
      engine.tone({ freq: f, when: 0.12 + i * 0.07, dur: 0.1, type: "square", gain: 0.05, release: 0.1, lowpass: 5000 });
    }
    // pad
    engine.tone({ freq: NOTES.A3, when: 0.05, dur: 0.6, type: "sine", gain: 0.06, attack: 0.05, release: 0.5, detune: 8 });
    engine.tone({ freq: NOTES.E4, when: 0.05, dur: 0.6, type: "sine", gain: 0.05, attack: 0.05, release: 0.5, detune: -8 });
  },

  // --- match events ---
  // Goal: a stadium swell — a filtered noise roar rising under a low thump.
  goal: () => {
    engine.noise({ dur: 0.5, gain: 0.11, filter: "bandpass", freq: 500, sweepTo: 1600, q: 0.7, attack: 0.08, release: 0.42 });
    engine.tone({ freq: NOTES.A2, dur: 0.22, type: "sine", gain: 0.16, release: 0.22, glideTo: NOTES.C3, lowpass: 400 });
    engine.tone({ freq: NOTES.A4, when: 0.18, dur: 0.2, type: "triangle", gain: 0.08, release: 0.2 });
  },
  // Red card: a darker, dissonant thud — the crowd-swell inverted.
  redCard: () => {
    engine.tone({ freq: NOTES.A2, dur: 0.28, type: "sawtooth", gain: 0.1, release: 0.28, glideTo: NOTES.A2 * 0.94, lowpass: 500 });
    engine.noise({ dur: 0.3, gain: 0.06, filter: "lowpass", freq: 900, sweepTo: 200, release: 0.3 });
  },

  // --- leaderboard ---
  // You climbed a spot: a quick upward whoosh + ding.
  rankUp: () => {
    engine.noise({ dur: 0.18, gain: 0.06, filter: "highpass", freq: 800, sweepTo: 5000, release: 0.18 });
    engine.tone({ freq: NOTES.E5, when: 0.1, dur: 0.14, type: "triangle", gain: 0.11, release: 0.14 });
  },
  // A genuine milestone (new best streak, top-3 entry): a bigger, brighter swell.
  milestone: () => {
    const seq = [NOTES.A4, NOTES.E5, NOTES.A5, NOTES.C6];
    seq.forEach((f, i) =>
      engine.tone({ freq: f, when: i * 0.05, dur: 0.3, type: "triangle", gain: 0.13, release: 0.28, detune: 6 }),
    );
    engine.noise({ dur: 0.4, gain: 0.05, filter: "highpass", freq: 5000, sweepTo: 9000, release: 0.4 });
  },

  // Theme flip: an airy swish, up to light / down to dark.
  theme: ({ dir = "up" }) => {
    const up = dir === "up";
    engine.noise({
      dur: 0.2,
      gain: 0.06,
      filter: "bandpass",
      freq: up ? 1200 : 3000,
      sweepTo: up ? 4000 : 800,
      q: 0.8,
      release: 0.2,
    });
    engine.tone({ freq: up ? NOTES.C4 : NOTES.C5, dur: 0.12, type: "sine", gain: 0.06, release: 0.12, glideTo: up ? NOTES.G4 : NOTES.G3 });
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
