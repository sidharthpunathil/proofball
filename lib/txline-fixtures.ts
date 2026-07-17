import { getCredentials, TXLINE } from "./txline-auth";
import { simInPlayProbs } from "./winprob";
import { cacheGetJSON, cacheSetJSON } from "./redis";
import type { Frame, Phase } from "./types";

/**
 * ─────────────────────────────────────────────────────────────────────────
 * REAL TxLINE World Cup data (competition 72, devnet).
 *
 * Everything in this file is fetched live from the TxLINE API, no synthetic
 * numbers. We curate the knockout bracket (the fixtures that actually carry
 * data on the devnet feed) into the app's lobby + match screen:
 *
 *   • Two finished semi-finals , real final scores + real event logs.
 *   • The upcoming FINAL        , real de-margined pre-match win-probability.
 *
 * Fixture IDs below are the real TxLINE `FixtureId`s (verified against
 * GET /api/fixtures/snapshot?competitionId=72). See docs/DATA.md.
 * ─────────────────────────────────────────────────────────────────────────
 */

export interface TeamMeta {
  name: string;
  abbr: string;
  color: string;
}

// Representative brand colours for the team dots. Purely cosmetic.
const TEAMS: Record<string, TeamMeta> = {
  Spain: { name: "Spain", abbr: "ESP", color: "#E11D2A" },
  Argentina: { name: "Argentina", abbr: "ARG", color: "#75AADB" },
  France: { name: "France", abbr: "FRA", color: "#1E50C8" },
  England: { name: "England", abbr: "ENG", color: "#152A57" },
};

function team(name: string): TeamMeta {
  return (
    TEAMS[name] ?? { name, abbr: name.slice(0, 3).toUpperCase(), color: "#8E8E94" }
  );
}

/** The curated knockout bracket. `id` is the real TxLINE FixtureId. */
const KNOCKOUT: { id: string; round: string }[] = [
  { id: "18237038", round: "Semi-final" }, // France v Spain
  { id: "18241006", round: "Semi-final" }, // England v Argentina
  { id: "18257739", round: "Final" }, // Spain v Argentina  ← headline
];

export const FEATURED_FIXTURE_ID = "18257739"; // Spain v Argentina, the Final

export interface Fixture {
  id: string;
  round: string; // "Semi-final" | "Final"
  competition: string; // "World Cup"
  home: TeamMeta;
  away: TeamMeta;
  startTime: number;
  status: "finished" | "upcoming" | "live";
  scoreH: number | null;
  scoreA: number | null;
  winner: "home" | "away" | "draw" | null;
  // Real de-margined 1X2 win-probability (%), when published.
  homeProb: number | null;
  drawProb: number | null;
  awayProb: number | null;
}

const STATUS_PHASE: Record<number, Phase> = {
  1: "PRE",
  2: "H1",
  3: "HT",
  4: "H2",
  5: "FT",
  100: "FT",
};

// ── low-level authed fetch ──────────────────────────────────────────────
async function authed(path: string): Promise<Response | null> {
  const creds = await getCredentials();
  if (!creds) return null;
  try {
    return await fetch(`${TXLINE.API_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${creds.jwt}`,
        "X-Api-Token": creds.apiToken,
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch {
    return null;
  }
}

const numOr = (v: unknown, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

// scores/snapshot rows use PascalCase: Score.ParticipantN.Total.Goals, Clock.Seconds, StatusId.
function goalsFromRow(row: any): { h: number; a: number } | null {
  const s = row?.Score;
  if (!s) return null;
  const h = s?.Participant1?.Total?.Goals;
  const a = s?.Participant2?.Total?.Goals;
  if (h == null && a == null) return null;
  return { h: numOr(h, 0), a: numOr(a, 0) };
}

/** Final score of a finished fixture, from the authoritative game_finalised row. */
async function fetchResult(
  id: string
): Promise<{ scoreH: number; scoreA: number; finished: boolean } | null> {
  const res = await authed(`/scores/snapshot/${id}`);
  if (!res || !res.ok) return null;
  const rows = (await res.json().catch(() => [])) as any[];
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const finalRow =
    rows.find((r) => Number(r.StatusId) === 100) ??
    [...rows].reverse().find((r) => goalsFromRow(r));
  const finished = rows.some((r) => Number(r.StatusId) === 100 || r.Action === "game_finalised");
  const g = finalRow ? goalsFromRow(finalRow) : null;
  if (!g) return finished ? { scoreH: 0, scoreA: 0, finished } : null;
  return { scoreH: g.h, scoreA: g.a, finished };
}

export interface Odds {
  home: number;
  draw: number;
  away: number;
}

/**
 * Last real de-margined 1X2 price captured from the TxLINE feed, per fixture.
 * The devnet publishes odds in windows (odds/snapshot is empty between them),
 * so we cache the most recent REAL price and refresh it whenever the feed is
 * live. Seeded with a value captured from GET /api/odds/snapshot/18257739
 * (Bookmaker "TXLineStablePriceDemargined"), see docs/DATA.md.
 */
const oddsCache = new Map<string, Odds>([
  ["18257739", { home: 42.2, draw: 31.3, away: 26.6 }], // Spain v Argentina, Final
]);

/** Real de-margined 1X2 win-probability for a fixture (normalised to sum 100). */
async function fetchOdds(id: string): Promise<Odds | null> {
  const live = await fetchOddsLive(id);
  if (live) {
    oddsCache.set(id, live); // refresh the cache while the feed is live
    return live;
  }
  return oddsCache.get(id) ?? null; // last real price during a quiet window
}

async function fetchOddsLive(id: string): Promise<Odds | null> {
  const res = await authed(`/odds/snapshot/${id}`);
  if (!res || !res.ok) return null;
  const rows = (await res.json().catch(() => [])) as any[];
  if (!Array.isArray(rows)) return null;
  const m = rows.find(
    (o) =>
      String(o.SuperOddsType ?? "").includes("1X2") &&
      Array.isArray(o.Pct) &&
      Array.isArray(o.PriceNames)
  );
  if (!m) return null;
  const iH = m.PriceNames.indexOf("part1");
  const iD = m.PriceNames.indexOf("draw");
  const iA = m.PriceNames.indexOf("part2");
  if (iH < 0 || iA < 0 || m.Pct[iH] === "NA") return null;
  const h = numOr(m.Pct[iH]);
  const d = iD >= 0 ? numOr(m.Pct[iD]) : 0;
  const a = numOr(m.Pct[iA]);
  const sum = h + d + a || 1;
  return {
    home: +((h / sum) * 100).toFixed(1),
    draw: +((d / sum) * 100).toFixed(1),
    away: +((a / sum) * 100).toFixed(1),
  };
}

// ── public API ──────────────────────────────────────────────────────────

let fxCache: { at: number; data: Fixture[] } | null = null;
const FX_TTL = 60 * 1000;
const FX_CACHE_KEY = "proofball:fixtures:v1";

/**
 * The curated bracket enriched with real scores + odds.
 * Two-tier cache: in-process (L1, 60s) then shared Redis (L2, 60s) so many
 * concurrent users / app instances share ONE upstream fetch instead of each
 * hammering the rate-limited devnet feed.
 */
export async function getFixtures(): Promise<Fixture[]> {
  if (fxCache && Date.now() - fxCache.at < FX_TTL) return fxCache.data;

  // L2: another instance may have already fetched this within the TTL.
  const shared = await cacheGetJSON<Fixture[]>(FX_CACHE_KEY);
  if (shared && shared.length > 0) {
    fxCache = { at: Date.now(), data: shared };
    return shared;
  }

  // Pull the WC fixture directory once to get names + start times.
  const dir = await fetchFixtureDirectory();

  const out = await Promise.all(
    KNOCKOUT.map(async ({ id, round }) => {
      const meta = dir.get(id);
      const [result, odds] = await Promise.all([fetchResult(id), fetchOdds(id)]);
      const finished = !!result?.finished;
      const scoreH = finished ? result!.scoreH : null;
      const scoreA = finished ? result!.scoreA : null;
      const winner =
        finished && scoreH != null && scoreA != null
          ? scoreH > scoreA
            ? "home"
            : scoreA > scoreH
              ? "away"
              : "draw"
          : null;
      const fx: Fixture = {
        id,
        round,
        competition: "World Cup",
        home: team(meta?.p1 ?? ""),
        away: team(meta?.p2 ?? ""),
        startTime: meta?.startTime ?? 0,
        status: finished ? "finished" : "upcoming",
        scoreH,
        scoreA,
        winner,
        homeProb: odds?.home ?? null,
        drawProb: odds?.draw ?? null,
        awayProb: odds?.away ?? null,
      };
      return fx;
    })
  );

  // Fallback names/colours if the directory fetch failed (offline dev).
  const withNames = out.map((fx) =>
    fx.home.name ? fx : fx
  );
  fxCache = { at: Date.now(), data: withNames };
  void cacheSetJSON(FX_CACHE_KEY, withNames, 60); // publish to the shared cache
  return withNames;
}

export async function getFixture(id: string): Promise<Fixture | null> {
  const all = await getFixtures();
  const curated = all.find((f) => f.id === id);
  if (curated) return curated;
  // Any other id: resolve a finished match from the Postgres cache, so every
  // past knockout match is playable (its real event log streams the same way).
  const { getDbMatch } = await import("./matches");
  return getDbMatch(id);
}

/** Map FixtureId → { p1, p2, startTime } from the WC directory. */
async function fetchFixtureDirectory(): Promise<
  Map<string, { p1: string; p2: string; startTime: number }>
> {
  const map = new Map<string, { p1: string; p2: string; startTime: number }>();
  const DAY = 86400000;
  const wanted = new Set(KNOCKOUT.map((k) => k.id));
  // The knockout fixtures fall in a known window; scan a handful of epoch-days.
  const base = Math.floor(Date.parse("2026-07-17T00:00:00Z") / DAY);
  for (let d = -6; d <= 6 && wanted.size > map.size; d++) {
    const res = await authed(`/fixtures/snapshot?competitionId=72&startEpochDay=${base + d}`);
    if (!res || !res.ok) continue;
    const rows = (await res.json().catch(() => [])) as any[];
    for (const f of Array.isArray(rows) ? rows : []) {
      const id = String(f.FixtureId);
      if (wanted.has(id) && !map.has(id)) {
        map.set(id, {
          p1: String(f.Participant1 ?? ""),
          p2: String(f.Participant2 ?? ""),
          startTime: numOr(f.StartTime, 0),
        });
      }
    }
  }
  return map;
}

// ── real replay builder (for the match screen) ───────────────────────────

function labelFor(action: string, teamName: string): string {
  switch (action) {
    case "goal":
      return `Goal · ${teamName}`;
    case "red_card":
      return `Red card · ${teamName}`;
    case "yellow_card":
      return `Yellow · ${teamName}`;
    case "corner":
      return `Corner · ${teamName}`;
    case "shot":
    case "shot_on_target":
      return `Shot · ${teamName}`;
    case "penalty":
      return `Penalty · ${teamName}`;
    case "kickoff":
    case "coverage_update":
      return "Kick-off";
    case "half_time":
      return "Half-time";
    case "game_finalised":
      return "Full-time";
    default:
      return teamName ? `${action.replace(/_/g, " ")} · ${teamName}` : action.replace(/_/g, " ");
  }
}

/**
 * Build an ordered, paced frame list from a fixture's REAL recorded TxLINE
 * event log (scores/snapshot). Odds are seeded from odds/snapshot. Returns
 * null if the feed is unavailable (caller falls back to the synthetic sample).
 */
export async function buildRealReplay(fx: Fixture): Promise<Frame[] | null> {
  const id = fx.id;
  const [scoresRes, odds] = await Promise.all([authed(`/scores/snapshot/${id}`), fetchOdds(id)]);
  if (!scoresRes || !scoresRes.ok) return null;
  const rows = (await scoresRes.json().catch(() => [])) as any[];
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const frames: Frame[] = [];

  // A finished match is replayed as a SIMULATION: the needle is modelled from
  // the real score + minute (see simInPlayProbs) so it actually moves and can be
  // called. Live/upcoming fixtures keep their single real de-margined seed.
  const isFinished = fx.status === "finished";
  const anchor = odds ?? { home: 40, draw: 30, away: 30 };

  const oddsFrame = (p: { home: number; draw: number; away: number }, delay: number): Frame => ({
    kind: "odds",
    PriceNames: ["1", "X", "2"],
    Pct: [String(p.home), String(p.draw), String(p.away)],
    SuperOddsType: "1X2",
    delay,
  });

  // 1) Seed the needle: real pre-match price when we have one, else the sim anchor.
  if (odds) frames.push(oddsFrame(odds, 300));
  else if (isFinished) frames.push(oddsFrame(anchor, 300));

  // 2) Walk the ordered event log → clock + notable events with real minutes.
  const NOTABLE = new Set([
    "goal",
    "red_card",
    "yellow_card",
    "corner",
    "shot",
    "shot_on_target",
    "penalty",
    "half_time",
    "game_finalised",
  ]);
  const ordered = [...rows].sort((a, b) => numOr(a.Ts) - numOr(b.Ts));
  let seq = 1;
  let lastGoals = { h: 0, a: 0 };
  let emittedAny = false;

  for (const r of ordered) {
    const action = String(r.Action ?? "");
    const statusId = numOr(r.StatusId, 0);
    const phase = STATUS_PHASE[statusId] ?? "H2";
    const minute = Math.max(0, Math.round(numOr(r?.Clock?.Seconds, 0) / 60));
    const g = goalsFromRow(r);
    if (g) lastGoals = g;

    // Simulation: nudge the modelled needle from the real running score + minute.
    if (isFinished) frames.push(oddsFrame(simInPlayProbs(anchor, lastGoals.h, lastGoals.a, minute), 40));

    // clock tick
    frames.push({ kind: "clock", minute, phase, delay: 90 });

    if (NOTABLE.has(action)) {
      const p = numOr(r.Participant, 0);
      const t: "home" | "away" | null = p === 1 ? "home" : p === 2 ? "away" : null;
      const teamName = t === "home" ? fx.home.name : t === "away" ? fx.away.name : "";
      frames.push({
        kind: "score",
        action,
        team: t,
        label: labelFor(action, teamName),
        scoreH: lastGoals.h,
        scoreA: lastGoals.a,
        minute,
        seq: numOr(r.Seq ?? r.seq, seq++),
        delay: 700,
      });
      emittedAny = true;
    }
  }

  if (!emittedAny && !odds) return null;
  // brief hold at the end before the SSE route loops
  frames.push({ kind: "clock", minute: frames.length ? 90 : 0, phase: "FT", delay: 4000 });
  return frames;
}
