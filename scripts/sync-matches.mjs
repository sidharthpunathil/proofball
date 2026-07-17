/**
 * Sync the TxLINE World Cup feed's FINISHED matches into Postgres.
 *
 *   docker compose up -d          # Postgres on :55432
 *   npm run matches:sync          # this script
 *
 * What it does:
 *   1. Pulls the full competition-72 fixture directory (teams + kickoff times).
 *   2. For every knockout fixture, reads scores/snapshot → final score + winner.
 *   3. Derives the round from the fixture's position in the knockout bracket
 *      (R32 → R16 → QF → SF → Third place → Final).
 *   4. Upserts the finished ones into `matches`.
 *
 * Group-stage fixtures carry no score data on the devnet feed, so they are
 * skipped , we never invent a scoreline. Re-runnable (idempotent upsert).
 */
import pg from "pg";

const ORIGIN = (process.env.TXLINE_API_BASE || "https://txline-dev.txodds.com/api").replace(/\/api\/?$/, "");
const API_BASE = process.env.TXLINE_API_BASE || "https://txline-dev.txodds.com/api";
const TOKEN = process.env.TXLINE_API_TOKEN?.trim();
const COMP = process.env.WORLDCUP_COMPETITION_ID || "72";
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://proofball:proofball@localhost:55432/proofball";

// Knockout fixture ids are all >= this; group-stage ids are below it.
const KNOCKOUT_MIN_ID = 18000000;
// The 2026 knockout bracket, in kickoff order. Sizes sum to 32.
const BRACKET = [
  { round: "Round of 32", rank: 1, count: 16 },
  { round: "Round of 16", rank: 2, count: 8 },
  { round: "Quarter-final", rank: 3, count: 4 },
  { round: "Semi-final", rank: 4, count: 2 },
  { round: "Third place", rank: 5, count: 1 },
  { round: "Final", rank: 6, count: 1 },
];

const DDL = `
CREATE TABLE IF NOT EXISTS matches (
  fixture_id  TEXT PRIMARY KEY,
  competition TEXT   NOT NULL DEFAULT 'World Cup',
  round       TEXT   NOT NULL,
  round_rank  INT    NOT NULL,
  home_name   TEXT   NOT NULL,
  home_id     INT,
  away_name   TEXT   NOT NULL,
  away_id     INT,
  start_time  BIGINT NOT NULL,
  score_h     INT,
  score_a     INT,
  winner      TEXT,
  finished    BOOLEAN NOT NULL DEFAULT TRUE,
  synced_at   BIGINT NOT NULL
);`;

const numOr = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

function goalsFromRow(row) {
  const s = row?.Score;
  if (!s) return null;
  const h = s?.Participant1?.Total?.Goals;
  const a = s?.Participant2?.Total?.Goals;
  if (h == null && a == null) return null;
  return { h: numOr(h), a: numOr(a) };
}

async function guestJwt() {
  const r = await fetch(`${ORIGIN}/auth/guest/start`, { method: "POST" });
  if (!r.ok) throw new Error(`guest/start ${r.status}`);
  return (await r.json()).token;
}

function authed(headers) {
  return async (path) => {
    try {
      const r = await fetch(`${API_BASE}${path}`, { headers, cache: "no-store" });
      if (!r.ok) return null;
      return await r.json().catch(() => null);
    } catch {
      return null;
    }
  };
}

/** Pull the whole competition directory across a wide epoch-day window. */
async function fetchDirectory(get) {
  const DAY = 86400000;
  const base = Math.floor(Date.parse("2026-07-17T00:00:00Z") / DAY);
  const map = new Map();
  for (let d = -40; d <= 20; d++) {
    const rows = await get(`/fixtures/snapshot?competitionId=${COMP}&startEpochDay=${base + d}`);
    for (const f of Array.isArray(rows) ? rows : []) {
      const id = String(f.FixtureId);
      if (!map.has(id)) {
        map.set(id, {
          id,
          p1: String(f.Participant1 ?? ""),
          p1Id: numOr(f.Participant1Id, null),
          p2: String(f.Participant2 ?? ""),
          p2Id: numOr(f.Participant2Id, null),
          startTime: numOr(f.StartTime, 0),
        });
      }
    }
  }
  return map;
}

/** Final score + finished flag for one fixture, from its recorded event log. */
async function fetchResult(get, id) {
  const rows = await get(`/scores/snapshot/${id}`);
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const finished = rows.some((r) => Number(r.StatusId) === 100 || r.Action === "game_finalised");
  if (!finished) return null;

  const ordered = [...rows].sort((a, b) => numOr(a.Ts) - numOr(b.Ts));
  const finalRow =
    ordered.find((r) => Number(r.StatusId) === 100) ??
    [...ordered].reverse().find((r) => goalsFromRow(r));
  let g = finalRow ? goalsFromRow(finalRow) : null;

  // Fallback: tally goal events if no row carried a Score object.
  if (!g) {
    let h = 0, a = 0;
    for (const r of ordered) {
      if (String(r.Action) === "goal") {
        const p = numOr(r.Participant, 0);
        if (p === 1) h++;
        else if (p === 2) a++;
      }
    }
    g = { h, a };
  }
  const winner = g.h > g.a ? "home" : g.a > g.h ? "away" : "draw";
  return { scoreH: g.h, scoreA: g.a, winner };
}

async function main() {
  if (!TOKEN) throw new Error("TXLINE_API_TOKEN not set , run with `node --env-file=.env`.");
  const jwt = await guestJwt();
  const get = authed({ Authorization: `Bearer ${jwt}`, "X-Api-Token": TOKEN, Accept: "application/json" });

  console.log("→ fetching fixture directory…");
  const dir = await fetchDirectory(get);
  console.log(`  ${dir.size} fixtures in competition ${COMP}`);

  // Knockout fixtures, in kickoff order → assign round by bracket position.
  const knockout = [...dir.values()]
    .filter((f) => Number(f.id) >= KNOCKOUT_MIN_ID)
    .sort((a, b) => a.startTime - b.startTime);
  console.log(`  ${knockout.length} knockout fixtures (expected 32)`);

  const roundByIndex = [];
  BRACKET.forEach((b) => { for (let i = 0; i < b.count; i++) roundByIndex.push(b); });

  console.log("→ reading results…");
  const finished = [];
  for (let i = 0; i < knockout.length; i++) {
    const f = knockout[i];
    const res = await fetchResult(get, f.id);
    if (!res) continue; // not finished yet (Final / third place) , skip
    const slot = roundByIndex[i] ?? { round: "Knockout", rank: 0 };
    finished.push({ ...f, ...res, round: slot.round, rank: slot.rank });
  }

  // Report what landed in each round so the mapping is easy to eyeball.
  const byRound = {};
  for (const m of finished) (byRound[m.round] ??= []).push(m);
  for (const b of BRACKET) {
    const list = byRound[b.round] ?? [];
    if (!list.length) continue;
    console.log(`  ${b.round}: ${list.length}`);
    for (const m of list) console.log(`     ${m.p1} ${m.scoreH}-${m.scoreA} ${m.p2}`);
  }

  console.log("→ writing to Postgres…");
  const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 4 });
  await pool.query(DDL);
  const now = Date.now();
  let n = 0;
  for (const m of finished) {
    await pool.query(
      `INSERT INTO matches
         (fixture_id, competition, round, round_rank, home_name, home_id,
          away_name, away_id, start_time, score_h, score_a, winner, finished, synced_at)
       VALUES ($1,'World Cup',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,TRUE,$12)
       ON CONFLICT (fixture_id) DO UPDATE SET
         round=EXCLUDED.round, round_rank=EXCLUDED.round_rank,
         home_name=EXCLUDED.home_name, away_name=EXCLUDED.away_name,
         start_time=EXCLUDED.start_time, score_h=EXCLUDED.score_h,
         score_a=EXCLUDED.score_a, winner=EXCLUDED.winner,
         finished=TRUE, synced_at=EXCLUDED.synced_at`,
      [m.id, m.round, m.rank, m.p1, m.p1Id, m.p2, m.p2Id, m.startTime, m.scoreH, m.scoreA, m.winner, now]
    );
    n++;
  }
  await pool.end();
  console.log(`✓ synced ${n} finished matches into Postgres.`);
}

main().catch((e) => { console.error("sync failed:", e.message); process.exit(1); });
