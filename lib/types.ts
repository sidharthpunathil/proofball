// Shapes mirror the real TxLINE payloads (OpenAPI v1.5.6) so the demo pipeline
// and the live pipeline are byte-compatible. See ProofBall.md §4.

/** Real TxLINE odds shape (subset we use). `Pct` = de-margined implied probability %. */
export interface OddsFrame {
  kind: "odds";
  PriceNames: string[]; // e.g. ["1","X","2"]
  Pct: string[]; // aligned to PriceNames; "NA" on quarter-handicap lines
  SuperOddsType?: string; // e.g. "1X2"
  delay: number; // ms to wait before emitting (replay pacing)
}

/** Real TxLINE score "action" record (subset we use). */
export interface ScoreFrame {
  kind: "score";
  action: string; // "goal" | "corner" | "yellow_card" | "red_card" | "shot" | "game_finalised" | ...
  team: "home" | "away" | null;
  label: string; // human label for the event feed
  scoreH: number;
  scoreA: number;
  minute: number;
  seq: number; // per-fixture sequence (real records increment from 1)
  delay: number;
}

/** Clock / phase transition. */
export interface ClockFrame {
  kind: "clock";
  minute: number;
  phase: Phase;
  delay: number;
}

export type Frame = OddsFrame | ScoreFrame | ClockFrame;

export type Phase = "PRE" | "H1" | "HT" | "H2" | "FT";

export interface MatchEvent {
  id: string;
  action: string;
  team: "home" | "away" | null;
  label: string;
  minute: number;
  big: boolean; // goals / red cards animate
}

export type PickDir = "up" | "down";
export type PickStatus = "open" | "locked" | "won" | "lost" | "skipped";

export interface Prediction {
  id: string;
  prompt: string;
  createdAt: number;
  lockAt: number;
  settleAt: number | null;
  dir: PickDir | null;
  lockedProb: number | null;
  status: PickStatus;
  delta?: number; // prob change at settle
  reward?: number; // coins won
  memoSig?: string;
  verifyUrl?: string;
}

export interface LeaderRow {
  name: string;
  coins: number;
  streak: number;
  you?: boolean;
}

/** Client-safe team identity (no server imports). */
export interface TeamView {
  name: string;
  abbr: string;
  color: string;
}

/** Client-safe fixture identity, mirrors the /api/txline/fixtures payload. */
export interface FixtureView {
  id: string;
  round: string; // "Semi-final" | "Final"
  competition: string; // "World Cup"
  home: TeamView;
  away: TeamView;
  startTime: number;
  status: "finished" | "upcoming" | "live";
  scoreH: number | null;
  scoreA: number | null;
  winner: "home" | "away" | "draw" | null;
  homeProb: number | null;
  drawProb: number | null;
  awayProb: number | null;
}
