import type { OddsFrame } from "./types";

/**
 * Turn a TxLINE odds frame into per-selection win probabilities.
 * `Pct` is already the de-margined implied probability (StablePrice removes the vig),
 * so we use it directly, this is ProofBall's whole edge. See ProofBall.md §4.
 */
export function probsFromOdds(o: OddsFrame): { name: string; prob: number | null }[] {
  return o.PriceNames.map((name, i) => ({
    name,
    prob: o.Pct[i] === "NA" ? null : Number(o.Pct[i]) / 100,
  }));
}

/** Home win-probability (%) from a 1X2 frame, selection "1" is home. */
export function homeWinPct(o: OddsFrame): number | null {
  const i = o.PriceNames.indexOf("1");
  if (i < 0 || o.Pct[i] === "NA") return null;
  return Number(o.Pct[i]);
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * SIMULATION model , in-play 1X2 win-probability from the current score + minute.
 *
 * Used ONLY to drive the needle when replaying a FINISHED match as a simulation
 * (the match is over, so there is no live feed to move it). The scores and
 * events feeding it are the fixture's REAL recorded log; this just interpolates
 * a plausible win-probability path from the real pre-match anchor toward the
 * real result, so a player can actually call the moves. It is clearly labelled
 * "simulation" in the UI and never stands in for a live/real price.
 *
 * @param anchor real de-margined pre-match {home,draw,away} in %, or a neutral tilt.
 */
export function simInPlayProbs(
  anchor: { home: number; draw: number; away: number },
  scoreH: number,
  scoreA: number,
  minute: number
): { home: number; draw: number; away: number } {
  const t = clamp(minute / 95, 0, 1); // match progress
  const lead = scoreH - scoreA;
  const k = 0.92 * t; // how strongly the current score dominates as time runs out

  // Where the home win-share heads given the current lead (at full time).
  const leadTarget =
    lead > 0
      ? 0.82 + Math.min(lead - 1, 3) * 0.05
      : lead < 0
        ? 0.18 - Math.min(-lead - 1, 3) * 0.05
        : 0.5;

  const preHomeShare = anchor.home / (anchor.home + anchor.away || 1); // pre-match, ignoring draw
  const homeShare = (1 - k) * preHomeShare + k * leadTarget;

  // The draw fades with time and collapses once someone leads.
  const draw = (anchor.draw / 100) * (1 - t) * (lead === 0 ? 1 : 0.35);
  const rest = 1 - draw;
  const h = homeShare * rest;
  const a = (1 - homeShare) * rest;
  const sum = h + draw + a || 1;
  return {
    home: +((h / sum) * 100).toFixed(1),
    draw: +((draw / sum) * 100).toFixed(1),
    away: +((a / sum) * 100).toFixed(1),
  };
}
