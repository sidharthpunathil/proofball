import { Pool } from "pg";

/**
 * Postgres pool for the finished-match cache.
 *
 * The TxLINE devnet feed carries ~100 World Cup fixtures; the knockout ones
 * carry real, FINISHED results (immutable). Rather than re-fetch every
 * scores/snapshot on each lobby load, we sync them once into Postgres
 * (`npm run matches:sync`) and read from here. See scripts/sync-matches.mjs.
 *
 * Runs against the docker-compose Postgres on the odd port 55432 by default.
 * If the DB is unreachable, lib/matches.ts falls back to the curated fixtures,
 * so the app never hard-depends on it.
 */

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://proofball:proofball@localhost:55432/proofball";

// Reuse one pool across hot reloads in dev (Next.js re-evaluates modules).
const g = globalThis as unknown as { _proofballPool?: Pool };

export function getPool(): Pool {
  if (!g._proofballPool) {
    g._proofballPool = new Pool({
      connectionString: DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 3000,
      idleTimeoutMillis: 30_000,
    });
    // Don't let a background client error crash the server.
    g._proofballPool.on("error", () => {});
  }
  return g._proofballPool;
}

/** DDL for the finished-match cache. Kept here so the app and the sync script agree. */
export const MATCHES_DDL = `
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
);
`;

export async function ensureSchema(): Promise<void> {
  await getPool().query(MATCHES_DDL);
}
