import { getDb } from "./d1";
import { teamMeta } from "./teams";
import type { Fixture } from "./txline-fixtures";

/**
 * Read side of the finished-match cache (D1 table `matches`, populated by
 * `npm run matches:sync`). Everything here degrades gracefully: if the DB is
 * unreachable or empty, callers fall back to the curated fixtures, so a missing
 * database never breaks the app , it just shows fewer past matches.
 */

interface MatchRow {
  fixture_id: string;
  competition: string;
  round: string;
  round_rank: number;
  home_name: string;
  away_name: string;
  start_time: number;
  score_h: number | null;
  score_a: number | null;
  winner: string | null;
}

function toFixture(r: MatchRow): Fixture {
  const scoreH = r.score_h;
  const scoreA = r.score_a;
  return {
    id: r.fixture_id,
    round: r.round,
    competition: r.competition,
    home: teamMeta(r.home_name),
    away: teamMeta(r.away_name),
    startTime: Number(r.start_time),
    status: "finished",
    scoreH,
    scoreA,
    winner: (r.winner as Fixture["winner"]) ?? null,
    homeProb: null,
    drawProb: null,
    awayProb: null,
  };
}

const SELECT = `
  SELECT fixture_id, competition, round, round_rank, home_name, away_name,
         start_time, score_h, score_a, winner
  FROM matches
  WHERE finished = 1
`;

/** All finished matches, latest rounds first then most recent kickoff first. */
export async function getFinishedMatches(): Promise<Fixture[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const { results } = await db
      .prepare(`${SELECT} ORDER BY round_rank DESC, start_time DESC`)
      .all<MatchRow>();
    return results.map(toFixture);
  } catch {
    return [];
  }
}

export interface RoundGroup {
  round: string;
  rank: number;
  matches: Fixture[];
}

/** Finished matches grouped by round, latest round first. */
export async function getFinishedMatchesByRound(): Promise<RoundGroup[]> {
  const all = await getFinishedMatches();
  const byRound = new Map<string, RoundGroup>();
  for (const fx of all) {
    const g = byRound.get(fx.round);
    if (g) g.matches.push(fx);
    else byRound.set(fx.round, { round: fx.round, rank: rankOf(fx.round), matches: [fx] });
  }
  return [...byRound.values()].sort((a, b) => b.rank - a.rank);
}

/** A single finished match by fixture id, or null if not cached / DB down. */
export async function getDbMatch(id: string): Promise<Fixture | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const row = await db.prepare(`${SELECT} AND fixture_id = ?1 LIMIT 1`).bind(id).first<MatchRow>();
    return row ? toFixture(row) : null;
  } catch {
    return null;
  }
}

// Rank fallback if a group somehow lacks it (kept in sync with the sync script).
function rankOf(round: string): number {
  switch (round) {
    case "Final":
      return 6;
    case "Third place":
      return 5;
    case "Semi-final":
      return 4;
    case "Quarter-final":
      return 3;
    case "Round of 16":
      return 2;
    case "Round of 32":
      return 1;
    default:
      return 0;
  }
}
