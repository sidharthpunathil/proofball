import { getRedis } from "./redis";

/**
 * The GLOBAL leaderboard , the multi-user heart of the app. Every player's
 * points live in a Redis sorted set (score = coins) plus a hash of streaks, so:
 *   • all users see the same ranking (not a per-browser fake list),
 *   • points persist across reloads / sessions and are restored on sign-in,
 *   • it scales to many concurrent users on one shared store.
 *
 * There is no seed / demo data: the board only ever shows real players who have
 * connected a wallet and made a call. If Redis is unavailable it returns empty.
 */

const ZKEY = "proofball:lb:coins"; // ZSET  member=name  score=coins
const HKEY = "proofball:lb:streak"; // HASH  name → streak

export interface Leader {
  name: string;
  coins: number;
  streak: number;
}

/** Upsert a player's coins + streak. Coins is the ranking key. */
export async function submitScore(name: string, coins: number, streak: number): Promise<void> {
  const r = getRedis();
  if (!r || !name) return;
  try {
    const pipe = r.pipeline();
    pipe.zadd(ZKEY, coins, name);
    pipe.hset(HKEY, name, String(streak));
    await pipe.exec();
  } catch {
    /* ignore , leaderboard is best-effort */
  }
}

/** Top N real players, highest coins first. Empty if Redis is unavailable. */
export async function topLeaders(n = 10): Promise<Leader[]> {
  const r = getRedis();
  if (!r) return [];
  try {
    const raw = await r.zrevrange(ZKEY, 0, n - 1, "WITHSCORES"); // [name, score, name, score, …]
    const streaks = await r.hgetall(HKEY);
    const out: Leader[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      out.push({
        name: raw[i],
        coins: Math.round(Number(raw[i + 1])),
        streak: Number(streaks[raw[i]] ?? 0),
      });
    }
    return out;
  } catch {
    return [];
  }
}

/** A single player's stored points, so we can restore them on sign-in. */
export async function getUserScore(name: string): Promise<Leader | null> {
  const r = getRedis();
  if (!r || !name) return null;
  try {
    const coins = await r.zscore(ZKEY, name);
    if (coins == null) return null;
    const streak = await r.hget(HKEY, name);
    return { name, coins: Math.round(Number(coins)), streak: Number(streak ?? 0) };
  } catch {
    return null;
  }
}
