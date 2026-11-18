import { getDb } from "./d1";
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
// Schema lives in migrations/0001_init.sql (D1).

/** A settled call as it crosses the API boundary (client → DB). */
export interface PickInput {
  id: string;
  dir: "up" | "down";
  status: "won" | "lost";
  atMinute?: number | null;
  delta?: number | null;
  reward?: number | null;
  fixtureId?: string | null;
  verifyUrl?: string | null;
  createdAt?: number | null;
  settledAt?: number | null;
}

/** Append (idempotent) a settled call for a wallet. No-throw: DB down → skip. */
export async function savePick(wallet: string, p: PickInput): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db
      .prepare(
        `INSERT INTO picks
           (wallet, pick_id, dir, status, delta, reward, fixture_id, verify_url, at_minute, created_at, settled_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
         ON CONFLICT (wallet, pick_id) DO NOTHING`,
      )
      .bind(
        wallet,
        p.id,
        p.dir,
        p.status,
        p.delta ?? null,
        Math.round(p.reward ?? 0),
        p.fixtureId ?? null,
        p.verifyUrl ?? null,
        p.atMinute ?? null,
        p.createdAt ?? Date.now(),
        p.settledAt ?? Date.now(),
      )
      .run();
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
  const db = getDb();
  if (!db) return EMPTY;
  try {
    const [recent, agg] = await db.batch<Record<string, unknown>>([
      db
        .prepare(
          `SELECT pick_id, dir, status, delta, reward, verify_url, at_minute, created_at, settled_at
             FROM picks WHERE wallet = ?1 ORDER BY settled_at DESC LIMIT ?2`,
        )
        .bind(wallet, limit),
      db
        .prepare(
          `SELECT COALESCE(SUM(reward), 0) AS earned,
                  SUM(CASE WHEN status = 'won'  THEN 1 ELSE 0 END) AS won,
                  SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) AS lost
             FROM picks WHERE wallet = ?1`,
        )
        .bind(wallet),
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = recent.results as any[];
    const picks: Prediction[] = rows.map((r) => ({
      id: String(r.pick_id),
      prompt: "",
      createdAt: Number(r.created_at),
      lockAt: 0,
      settleAt: Number(r.settled_at),
      dir: r.dir === "up" || r.dir === "down" ? r.dir : null,
      lockedProb: null,
      status: r.status === "won" ? "won" : "lost",
      atMinute: r.at_minute != null ? Number(r.at_minute) : undefined,
      delta: r.delta != null ? Number(r.delta) : undefined,
      reward: Number(r.reward),
      verifyUrl: r.verify_url ?? undefined,
    }));
    const a = (agg.results[0] ?? {}) as Record<string, unknown>;
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
