import { getDb } from "./d1";

/**
 * Small key/value helpers on top of D1 (table `kv`), replacing what Redis did:
 *   • a shared JSON cache with a TTL (TxLINE fixtures feed, finished replays),
 *   • single-use values (SIWS nonces) read and deleted in one statement,
 *   • fixed-window rate limits (table `rate_limits`).
 *
 * Everything degrades the way the Redis version did: cache helpers never throw,
 * rateLimit fails OPEN, and callers that must fail CLOSED check for a null DB.
 */

/** JSON cache read; returns null on miss, expiry or any error. */
export async function cacheGetJSON<T>(key: string): Promise<T | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const row = await db
      .prepare("SELECT value FROM kv WHERE key = ?1 AND (expires_at IS NULL OR expires_at > ?2)")
      .bind(key, Date.now())
      .first<{ value: string }>();
    return row ? (JSON.parse(row.value) as T) : null;
  } catch {
    return null;
  }
}

/** JSON cache write with a TTL (seconds); best-effort, never throws. */
export async function cacheSetJSON(key: string, value: unknown, ttlSec: number): Promise<void> {
  const db = getDb();
  if (!db) return;
  const now = Date.now();
  try {
    await db
      .prepare(
        `INSERT INTO kv (key, value, expires_at) VALUES (?1, ?2, ?3)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at`,
      )
      .bind(key, JSON.stringify(value), now + ttlSec * 1000)
      .run();
    // Redis expired keys on its own; here we sweep now and then instead.
    if (Math.random() < 0.02) {
      await db.batch([
        db.prepare("DELETE FROM kv WHERE expires_at IS NOT NULL AND expires_at <= ?1").bind(now),
        db.prepare("DELETE FROM rate_limits WHERE reset_at <= ?1").bind(now),
      ]);
    }
  } catch {
    /* ignore: the cache is best-effort (a value over D1's 2 MB row cap just isn't cached) */
  }
}

/** Store a string under `key` for `ttlSec`. Returns false if it could not be stored. */
export async function kvPut(key: string, value: string, ttlSec: number): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    await db
      .prepare(
        `INSERT INTO kv (key, value, expires_at) VALUES (?1, ?2, ?3)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at`,
      )
      .bind(key, value, Date.now() + ttlSec * 1000)
      .run();
    return true;
  } catch {
    return false;
  }
}

/**
 * Atomically read and delete a live value (Redis GETDEL). Resolves to the value,
 * or null if it was missing or expired. Throws if the store is unavailable, so
 * callers that fail closed can tell "no such nonce" from "no database".
 */
export async function kvTake(key: string): Promise<string | null> {
  const db = getDb();
  if (!db) throw new Error("store unavailable");
  const row = await db
    .prepare("DELETE FROM kv WHERE key = ?1 RETURNING value, expires_at")
    .bind(key)
    .first<{ value: string; expires_at: number | null }>();
  if (!row) return null;
  if (row.expires_at != null && row.expires_at <= Date.now()) return null;
  return row.value;
}

/**
 * Fixed-window rate limit. Returns true if the call is ALLOWED (within `limit`
 * per `windowSec`). One upsert per call, so it is race-free across requests.
 * Fails OPEN if the store is unavailable; pair it with another guard on routes
 * where abuse spends real resources.
 */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
  const db = getDb();
  if (!db) return true;
  const now = Date.now();
  try {
    const row = await db
      .prepare(
        `INSERT INTO rate_limits (key, count, reset_at) VALUES (?1, 1, ?2)
         ON CONFLICT (key) DO UPDATE SET
           count    = CASE WHEN rate_limits.reset_at <= ?3 THEN 1 ELSE rate_limits.count + 1 END,
           reset_at = CASE WHEN rate_limits.reset_at <= ?3 THEN excluded.reset_at ELSE rate_limits.reset_at END
         RETURNING count`,
      )
      .bind(`proofball:rl:${key}`, now + windowSec * 1000, now)
      .first<{ count: number }>();
    return (row?.count ?? 0) <= limit;
  } catch {
    return true;
  }
}

/** Best-effort client IP. Cloudflare sets cf-connecting-ip; fall back to proxy headers. */
export function clientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
