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
 * Stored as a Redis HASH: field = wallet, value = JSON(AirdropRecord).
 */
import { getRedis } from "./redis";

export const AIRDROP_LEDGER_KEY = "proofball:airdrops";

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
  const r = getRedis();
  if (!r) return;
  try {
    await r.hset(AIRDROP_LEDGER_KEY, rec.wallet, JSON.stringify(rec));
  } catch {
    /* the ledger is best-effort — a write failure must never break the airdrop */
  }
}

/** One wallet's airdrop record, or null if it has none / Redis is down. */
export async function getAirdropRecord(wallet: string): Promise<AirdropRecord | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    const raw = await r.hget(AIRDROP_LEDGER_KEY, wallet);
    return raw ? (JSON.parse(raw) as AirdropRecord) : null;
  } catch {
    return null;
  }
}

/** The full ledger (all wallets), newest first. Empty on any error. */
export async function listAirdrops(): Promise<AirdropRecord[]> {
  const r = getRedis();
  if (!r) return [];
  try {
    const all = await r.hgetall(AIRDROP_LEDGER_KEY);
    const recs = Object.values(all)
      .map((v) => {
        try {
          return JSON.parse(v) as AirdropRecord;
        } catch {
          return null;
        }
      })
      .filter((x): x is AirdropRecord => x !== null);
    recs.sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));
    return recs;
  } catch {
    return [];
  }
}
