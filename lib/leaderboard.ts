import { getDb } from "./d1";

/**
 * The GLOBAL leaderboard , the multi-user heart of the app. Every player's
 * points live in the D1 `leaderboard` table (name, coins, streak), so:
 *   • all users see the same ranking (not a per-browser fake list),
 *   • points persist across reloads / sessions and are restored on sign-in,
 *   • it scales to many concurrent users on one shared store.
 *
 * There is no seed / demo data: the board only ever shows real players who have
 * connected a wallet and made a call. If the database is unavailable it returns empty.
 */


export interface Leader {
  name: string;
  coins: number;
  streak: number;
}

/** Upsert a player's coins + streak. Coins is the ranking key. */
export async function submitScore(name: string, coins: number, streak: number): Promise<void> {
  const db = getDb();
  if (!db || !name) return;
  try {
    await db
      .prepare(
        `INSERT INTO leaderboard (name, coins, streak) VALUES (?1, ?2, ?3)
         ON CONFLICT (name) DO UPDATE SET coins = excluded.coins, streak = excluded.streak`,
      )
      .bind(name, Math.round(coins), Math.round(streak))
      .run();
  } catch {
    /* ignore , leaderboard is best-effort */
  }
}

/** Top N real players, highest coins first. Empty if the database is unavailable. */
export async function topLeaders(n = 10): Promise<Leader[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const { results } = await db
      .prepare("SELECT name, coins, streak FROM leaderboard ORDER BY coins DESC, name DESC LIMIT ?1")
      .bind(n)
      .all<Leader>();
    return results.map((r) => ({ name: r.name, coins: Number(r.coins), streak: Number(r.streak) }));
  } catch {
    return [];
  }
}

/** A single player's stored points, so we can restore them on sign-in. */
export async function getUserScore(name: string): Promise<Leader | null> {
  const db = getDb();
  if (!db || !name) return null;
  try {
    const r = await db
      .prepare("SELECT name, coins, streak FROM leaderboard WHERE name = ?1")
      .bind(name)
      .first<Leader>();
    return r ? { name: r.name, coins: Number(r.coins), streak: Number(r.streak) } : null;
  } catch {
    return null;
  }
}
