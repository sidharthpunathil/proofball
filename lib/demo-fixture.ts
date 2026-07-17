import type { Frame, Phase } from "./types";
import { clamp } from "./winprob";

/**
 * ─────────────────────────────────────────────────────────────────────────
 * SAMPLE REPLAY DATA, for local development only.
 *
 * This is a *synthetic* match arc shaped exactly like real TxLINE payloads so
 * the app runs with zero credentials. It is NOT real TxLINE data.
 *
 * ⚠️ BEFORE SUBMITTING: replace this with a REAL recorded TxLINE feed
 * (record a live World Cup match, see ProofBall.md §5 "Day 0"). Shipping
 * fabricated data claimed as "live" is a disqualification. The recorded feed
 * plugs into the exact same SSE pipeline, so nothing else changes.
 * ─────────────────────────────────────────────────────────────────────────
 */

// Default/featured match identity: the real World Cup Final (Spain v Argentina,
// TxLINE FixtureId 18257739). Used as the fallback fixture-context value, for
// the OG share card, and if the fixtures API is briefly unreachable. Live match
// state (score, minute, win-probability) always comes from the TxLINE feed.
export const MATCH = {
  id: "18257739",
  home: "Spain",
  away: "Argentina",
  homeAbbr: "ESP",
  awayAbbr: "ARG",
  homeColor: "#E11D2A",
  awayColor: "#75AADB",
  competition: "World Cup · Final",
};

// Key beats: [matchMinute, homeWinProb%, optional event]
type Beat = {
  m: number;
  p: number;
  ev?: { action: string; team: "home" | "away" | null; label: string; sh: number; sa: number };
  phase?: Phase;
};

const BEATS: Beat[] = [
  { m: 0, p: 54, phase: "H1", ev: { action: "kickoff", team: null, label: "Kick-off", sh: 0, sa: 0 } },
  { m: 8, p: 58 },
  { m: 12, p: 60, ev: { action: "shot", team: "home", label: "Shot · Spain", sh: 0, sa: 0 } },
  { m: 18, p: 61, ev: { action: "corner", team: "home", label: "Corner · Spain", sh: 0, sa: 0 } },
  { m: 23, p: 71, ev: { action: "goal", team: "home", label: "Goal · Spain", sh: 1, sa: 0 } },
  { m: 30, p: 66 },
  { m: 34, p: 60, ev: { action: "yellow_card", team: "away", label: "Yellow · Argentina", sh: 1, sa: 0 } },
  { m: 40, p: 50, ev: { action: "goal", team: "away", label: "Goal · Argentina", sh: 1, sa: 1 } },
  { m: 45, p: 51, phase: "HT", ev: { action: "half_time", team: null, label: "Half-time", sh: 1, sa: 1 } },
  { m: 46, p: 52, phase: "H2" },
  { m: 52, p: 67, ev: { action: "red_card", team: "away", label: "Red card · Argentina", sh: 1, sa: 1 } },
  { m: 60, p: 72, ev: { action: "shot", team: "home", label: "Shot · Spain", sh: 1, sa: 1 } },
  { m: 67, p: 83, ev: { action: "goal", team: "home", label: "Goal · Spain", sh: 2, sa: 1 } },
  { m: 75, p: 81 },
  { m: 82, p: 83, ev: { action: "corner", team: "home", label: "Corner · Spain", sh: 2, sa: 1 } },
  { m: 88, p: 85 },
  { m: 90, p: 88, phase: "FT", ev: { action: "game_finalised", team: null, label: "Full-time", sh: 2, sa: 1 } },
];

function interpProb(minute: number): number {
  for (let i = 0; i < BEATS.length - 1; i++) {
    const a = BEATS[i];
    const b = BEATS[i + 1];
    if (minute >= a.m && minute <= b.m) {
      const t = (minute - a.m) / (b.m - a.m || 1);
      const base = a.p + (b.p - a.p) * t;
      const wiggle = Math.sin(minute * 1.7) * 1.1; // gentle liveliness
      return clamp(base + wiggle, 3, 97);
    }
  }
  return BEATS[BEATS.length - 1].p;
}

function pctTriplet(homeP: number, minute: number): string[] {
  const draw = clamp(30 - minute * 0.17 - Math.abs(homeP - 50) * 0.14, 5, 30);
  const away = clamp(100 - homeP - draw, 2, 95);
  const sum = homeP + draw + away;
  return [
    ((homeP / sum) * 100).toFixed(1),
    ((draw / sum) * 100).toFixed(1),
    ((away / sum) * 100).toFixed(1),
  ];
}

/** Build the ordered frame list (loops in the SSE route). ~90s per cycle. */
export function buildReplay(): Frame[] {
  const frames: Frame[] = [];
  let seq = 1;
  let phase: Phase = "PRE";
  let sh = 0;
  let sa = 0;
  const STEP = 1.5; // match-minutes per odds tick
  const TICK_MS = 950; // real ms per odds tick (accelerated)

  const eventAt = new Map<number, Beat>();
  for (const b of BEATS) if (b.ev) eventAt.set(b.m, b);

  for (let m = 0; m <= 90; m += STEP) {
    const mm = Math.round(m);

    // Emit a discrete event/clock frame if a beat lands near this minute.
    const beat = eventAt.get(mm);
    if (beat?.ev) {
      const e = beat.ev;
      sh = e.sh;
      sa = e.sa;
      if (beat.phase) phase = beat.phase;
      frames.push({
        kind: "score",
        action: e.action,
        team: e.team,
        label: e.label,
        scoreH: sh,
        scoreA: sa,
        minute: mm,
        seq: seq++,
        delay: 260,
      });
      eventAt.delete(mm);
    } else if (beat?.phase) {
      phase = beat.phase;
    }

    if (phase === "PRE") phase = "H1";

    frames.push({
      kind: "clock",
      minute: mm,
      phase,
      delay: 40,
    });

    const homeP = interpProb(m);
    frames.push({
      kind: "odds",
      PriceNames: ["1", "X", "2"],
      Pct: pctTriplet(homeP, m),
      SuperOddsType: "1X2",
      delay: TICK_MS,
    });
  }

  // brief hold on full-time before the route loops
  frames.push({ kind: "clock", minute: 90, phase: "FT", delay: 4000 });
  return frames;
}
