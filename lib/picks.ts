import { getPool } from "./db";
import type { Prediction } from "./types";

/**
 * Durable per-wallet record of settled calls ("Your calls").
 *
 * The client keeps a localStorage cache for instant paint, but that is easy to
 * lose (a persist write before rehydrate, a cleared cache, a different device).
 * This is the authoritative store: each settled call is written here keyed by
 * the player's wallet, and loaded back on sign-in — so calls survive reloads,
 * tab switches and devices. Like the matches cache, every call is wrapped so a
 * DB outage degrades to the localStorage cache instead of throwing.
 */
export const PICKS_DDL = `
CREATE TABLE IF NOT EXISTS picks (
  wallet      TEXT   NOT NULL,
  pick_id     TEXT   NOT NULL,
  dir         TEXT   NOT NULL,          -- 'up' | 'down'
  status      TEXT   NOT NULL,          -- 'won' | 'lost'
  delta       REAL,                     -- win-prob change at settle
  reward      INT    NOT NULL DEFAULT 0,-- +winnings on a win, -stake on a loss
  fixture_id  TEXT,
  verify_url  TEXT,
  created_at  BIGINT NOT NULL,
  settled_at  BIGINT NOT NULL,
  PRIMARY KEY (wallet, pick_id)
);
CREATE INDEX IF NOT EXISTS picks_wallet_settled ON picks (wallet, settled_at DESC);
`;

// Ensure the table exists once per process (cached promise; reset on failure so
// a transient DB blip can be retried rather than poisoning every later call).
let schemaReady: Promise<void> | null = null;
function ensurePicksSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = getPool()
      .query(PICKS_DDL)
      .then(() => {})
      .catch((e) => {
        schemaReady = null;
        throw e;
      });
  }
  return schemaReady;
}

/** A settled call as it crosses the API boundary (client → DB). */
export interface PickInput {
  id: string;
  dir: "up" | "down";
  status: "won" | "lost";
  delta?: number | null;
  reward?: number | null;
  fixtureId?: string | null;
  verifyUrl?: string | null;
  createdAt?: number | null;
  settledAt?: number | null;
}

/** Append (idempotent) a settled call for a wallet. No-throw: DB down → skip. */
export async function savePick(wallet: string, p: PickInput): Promise<void> {
  try {
    await ensurePicksSchema();
    await getPool().query(
      `INSERT INTO picks
         (wallet, pick_id, dir, status, delta, reward, fixture_id, verify_url, created_at, settled_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (wallet, pick_id) DO NOTHING`,
      [
        wallet,
        p.id,
        p.dir,
        p.status,
        p.delta ?? null,
        Math.round(p.reward ?? 0),
        p.fixtureId ?? null,
        p.verifyUrl ?? null,
        p.createdAt ?? Date.now(),
        p.settledAt ?? Date.now(),
      ]
    );
  } catch {
    /* DB unavailable — the localStorage cache still holds the call */
  }
}

export interface PicksLoad {
  picks: Prediction[];
  earned: number; // net $PROOF from all calls (Σ reward)
  won: number;
  lost: number;
}

const EMPTY: PicksLoad = { picks: [], earned: 0, won: 0, lost: 0 };

/** Load a wallet's recent calls + the lifetime earned/W-L aggregate. */
export async function loadPicks(wallet: string, limit = 30): Promise<PicksLoad> {
  try {
    await ensurePicksSchema();
    const pool = getPool();
    const [recent, agg] = await Promise.all([
      pool.query(
        `SELECT pick_id, dir, status, delta, reward, verify_url, created_at, settled_at
           FROM picks WHERE wallet = $1 ORDER BY settled_at DESC LIMIT $2`,
        [wallet, limit]
      ),
      pool.query(
        `SELECT COALESCE(SUM(reward), 0) AS earned,
                COUNT(*) FILTER (WHERE status = 'won')  AS won,
                COUNT(*) FILTER (WHERE status = 'lost') AS lost
           FROM picks WHERE wallet = $1`,
        [wallet]
      ),
    ]);
    const picks: Prediction[] = recent.rows.map((r) => ({
      id: String(r.pick_id),
      prompt: "",
      createdAt: Number(r.created_at),
      lockAt: 0,
      settleAt: Number(r.settled_at),
      dir: r.dir === "up" || r.dir === "down" ? r.dir : null,
      lockedProb: null,
      status: r.status === "won" ? "won" : "lost",
      delta: r.delta != null ? Number(r.delta) : undefined,
      reward: Number(r.reward),
      verifyUrl: r.verify_url ?? undefined,
    }));
    const a = agg.rows[0] ?? {};
    return {
      picks,
      earned: Number(a.earned ?? 0),
      won: Number(a.won ?? 0),
      lost: Number(a.lost ?? 0),
    };
  } catch {
    return EMPTY;
  }
}
