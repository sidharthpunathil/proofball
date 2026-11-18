import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * The app's one database: Cloudflare D1, bound as `DB` in wrangler.jsonc.
 *
 * It holds everything Postgres and Redis used to: the finished-match cache,
 * settled picks, the leaderboard, the airdrop ledger and claims, top-up
 * idempotency, rate limits, SIWS nonces and the shared JSON cache.
 *
 * Returns null when there is no binding (unit tests, a plain `node` script),
 * so every caller can keep its existing degrade-gracefully path.
 */
export function getDb(): D1Database | null {
  try {
    return (getCloudflareContext().env as { DB?: D1Database }).DB ?? null;
  } catch {
    return null;
  }
}

/** The R2 bucket that holds large static files (the whitepaper PDF). */
export function getAssetsBucket(): R2Bucket | null {
  try {
    return (getCloudflareContext().env as { ASSETS_BUCKET?: R2Bucket }).ASSETS_BUCKET ?? null;
  } catch {
    return null;
  }
}
