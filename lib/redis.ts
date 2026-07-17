import Redis from "ioredis";

/**
 * Shared Redis client (docker-compose, odd port 63799). Backs two multi-user
 * concerns:
 *   • the GLOBAL leaderboard (a ZSET everyone reads/writes), see lib/leaderboard.ts
 *   • a CROSS-INSTANCE cache of the TxLINE fixtures feed, so N app instances /
 *     many concurrent users share one upstream fetch instead of each hammering
 *     the rate-limited devnet feed.
 *
 * Everything degrades gracefully: if Redis is down, `getRedis()` still returns a
 * client but commands fail fast (offline queue disabled) and every caller wraps
 * them in try/catch, falling back to in-memory / seed data.
 */

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:63799";

const g = globalThis as unknown as { _proofballRedis?: Redis | null };

export function getRedis(): Redis | null {
  if (g._proofballRedis !== undefined) return g._proofballRedis;
  try {
    const client = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false, // fail fast when disconnected → callers fall back
      connectTimeout: 2000,
      retryStrategy: (times) => (times > 8 ? null : Math.min(times * 200, 2000)),
    });
    client.on("error", () => {}); // swallow transient connection noise
    g._proofballRedis = client;
  } catch {
    g._proofballRedis = null;
  }
  return g._proofballRedis;
}

/** JSON cache read; returns null on miss / any error. */
export async function cacheGetJSON<T>(key: string): Promise<T | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    const raw = await r.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** JSON cache write with a TTL (seconds); best-effort, never throws. */
export async function cacheSetJSON(key: string, value: unknown, ttlSec: number): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.set(key, JSON.stringify(value), "EX", ttlSec);
  } catch {
    /* ignore */
  }
}

/**
 * Fixed-window rate limit. Returns true if the call is ALLOWED (i.e. this hit is
 * within `limit` per `windowSec`). One atomic INCR (+EXPIRE on the first hit of a
 * window) per bucket, so it is race-free across concurrent requests.
 *
 * Fails OPEN (allows) if Redis is unavailable, so a Redis outage never hard-locks
 * the app — always pair it with another guard (auth, per-wallet cap) on routes
 * where abuse spends real resources.
 */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
  const r = getRedis();
  if (!r) return true; // no store → don't hard-block; caller has other guards
  try {
    const LUA = `local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return n`;
    const n = Number(await r.eval(LUA, 1, `proofball:rl:${key}`, String(windowSec)));
    return n <= limit;
  } catch {
    return true;
  }
}

/** Best-effort client IP from proxy headers, for per-IP rate limiting. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
