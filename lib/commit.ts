import { createHash, randomBytes } from "crypto";

export interface CommitInput {
  matchId: string;
  marketId: string;
  wallet: string;
  dir: string; // "up" | "down"
  lockedProb: number | string;
  ts: number;
}

export interface Commitment {
  commitment: string; // full sha256 hex
  memoSig: string; // short id surfaced to the user
  tag: string; // what would go into the SPL-Memo: proofball:v1:<hash>
  salt: string;
  preimage: string;
}

/**
 * Deterministic commitment for a locked prediction. Hashing
 * (match|market|wallet|pick|prob|ts|salt) proves the pick was fixed BEFORE the
 * outcome existed, this is the "provably fair" primitive. In live mode this
 * `tag` becomes the memo of an on-chain SPL-Memo tx (ProofBall.md §4).
 *
 * `salt` and `ts` are injectable so the function is fully testable.
 */
export function buildCommitment(input: CommitInput, salt?: string): Commitment {
  const s = salt ?? randomBytes(8).toString("hex");
  const preimage = [
    input.matchId,
    input.marketId,
    input.wallet,
    input.dir,
    String(input.lockedProb),
    String(input.ts),
    s,
  ].join("|");
  const commitment = createHash("sha256").update(preimage).digest("hex");
  return {
    commitment,
    memoSig: commitment.slice(0, 16),
    tag: `proofball:v1:${commitment.slice(0, 24)}`,
    salt: s,
    preimage,
  };
}
