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
 * client but commands fail fast and every caller wraps them in try/catch,
 * falling back to in-memory / seed data.
 *
 * The client HANGS UP WHEN IDLE, and that is load-bearing for hosting cost.
 * Railway's Serverless mode only stops a service after ~10 minutes with no
 * OUTBOUND packets, and a parked Redis socket silently defeats that: Redis ships
 * `tcp-keepalive 300`, so the server probes an idle client every 5 minutes and
 * the client's kernel ACKs — an outbound packet that re-arms the idle timer
 * forever. One connection therefore pins the whole app awake 24/7, which was the
 * single largest line item on this project's bill. So the socket is dropped after
 * a quiet spell and re-dialled on the next command.
 */

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:63799";

/** Quiet period before the socket is dropped. 0 disables the hang-up entirely. */
const IDLE_HANGUP_MS = Number(process.env.REDIS_IDLE_HANGUP_MS ?? 45_000);

const g = globalThis as unknown as {
  _proofballRedis?: Redis | null;
  _proofballRedisIdle?: ReturnType<typeof setTimeout>;
};

/**
 * (Re)start the countdown to hanging up. Called on every `getRedis()`, which is
 * every call site's first step, so it tracks real usage closely enough.
 */
function armIdleHangup(client: Redis): void {
  if (g._proofballRedisIdle) clearTimeout(g._proofballRedisIdle);
  g._proofballRedisIdle = undefined;
  if (!(IDLE_HANGUP_MS > 0)) return;
  const timer = setTimeout(() => {
    g._proofballRedisIdle = undefined;
    // "wait" = lazyConnect, never dialled; "end" = already hung up. Anything else
    // owns a socket (or is retrying over one), and retries are outbound too.
    if (client.status !== "end" && client.status !== "wait") client.disconnect();
  }, IDLE_HANGUP_MS);
  timer.unref?.(); // a pending timer must never be the thing keeping Node alive
  g._proofballRedisIdle = timer;
}

export function getRedis(): Redis | null {
  if (g._proofballRedis === null) return null; // construction already failed once
  let client = g._proofballRedis;
  if (!client) {
    try {
      client = new Redis(REDIS_URL, {
        maxRetriesPerRequest: 1, // a REAL outage still fails fast, not after 20 tries
        // ON, specifically BECAUSE we hang up when idle: a command issued while the
        // socket is down has to WAIT for the redial rather than fail. Routes that
        // fail CLOSED on a Redis error (SIWS nonce, top-up idempotency, airdrop
        // claim) would otherwise 503 purely because the app had been sitting quiet.
        enableOfflineQueue: true,
        lazyConnect: true, // don't dial until something actually needs Redis
        connectTimeout: 2000,
        retryStrategy: (times) => (times > 8 ? null : Math.min(times * 200, 2000)),
      });
      client.on("error", () => {}); // swallow transient connection noise
      g._proofballRedis = client;
    } catch {
      g._proofballRedis = null;
      return null;
    }
  }
  // "end" is where our own hang-up leaves the client (and where retryStrategy
  // lands after giving up). ioredis will not redial from there on its own, so do
  // it here; the offline queue holds this caller's command until the socket is up.
  // From "wait" ioredis dials itself on the first command.
  if (client.status === "end") void client.connect().catch(() => {});
  armIdleHangup(client);
  return client;
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
