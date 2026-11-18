/**
 * The welcome-airdrop ledger — a durable record of every wallet that received (or
 * was checked for) the one-time $PROOF airdrop.
 *
 * This exists BECAUSE the airdrop is a real on-chain mint of real (devnet) value:
 * we need an auditable answer to "who got airdropped, how much, and which tx?" —
 * and, critically, a record that is NEVER torn down on a transient error. The old
 * guard was a bare SET of addresses that the route deleted from on any mint failure
 * (`srem`), which is exactly what let a wallet be airdropped twice when a mint timed
 * out on confirmation but still landed on-chain. This ledger is append/update-only.
 *
 * Stored in the D1 `airdrops` table: one row per wallet, record = JSON(AirdropRecord).
 */
import { getDb } from "./d1";

export type AirdropStatus =
  | "airdropped" // minted this session, confirmed
  | "landed-late" // mint threw on confirmation but the tokens are on-chain
  | "already-funded"; // wallet already held the airdrop (no mint this time)

export interface AirdropRecord {
  wallet: string;
  amount: number; // whole $PROOF this airdrop grants (the constant)
  position: number | null; // 1-indexed spot in the first N, if known
  ts: number; // epoch ms of this record
  signature: string | null; // mint tx signature, when minted this session
  status: AirdropStatus;
  balance?: number; // on-chain $PROOF at record time — flags anomalies (e.g. a
  // pre-fix double-airdrop shows balance 2000 against a 1000 amount)
}

/** Durably record (or update) a wallet's airdrop. Best-effort; never throws. */
export async function recordAirdrop(rec: AirdropRecord): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db
      .prepare(
        `INSERT INTO airdrops (wallet, record, ts) VALUES (?1, ?2, ?3)
         ON CONFLICT (wallet) DO UPDATE SET record = excluded.record, ts = excluded.ts`,
      )
      .bind(rec.wallet, JSON.stringify(rec), rec.ts ?? Date.now())
      .run();
  } catch {
    /* the ledger is best-effort — a write failure must never break the airdrop */
  }
}

/** One wallet's airdrop record, or null if it has none / the database is down. */
export async function getAirdropRecord(wallet: string): Promise<AirdropRecord | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const row = await db
      .prepare("SELECT record FROM airdrops WHERE wallet = ?1")
      .bind(wallet)
      .first<{ record: string }>();
    return row ? (JSON.parse(row.record) as AirdropRecord) : null;
  } catch {
    return null;
  }
}

/** The full ledger (all wallets), newest first. Empty on any error. */
export async function listAirdrops(): Promise<AirdropRecord[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const { results } = await db
      .prepare("SELECT record FROM airdrops ORDER BY ts DESC")
      .all<{ record: string }>();
    return results
      .map((r) => {
        try {
          return JSON.parse(r.record) as AirdropRecord;
        } catch {
          return null;
        }
      })
      .filter((x): x is AirdropRecord => x !== null);
  } catch {
    return [];
  }
}
