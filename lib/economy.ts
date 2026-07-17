/**
 * The $PROOF economy, in one place. Tweak these and the whole game retunes.
 *
 * $PROOF is a real devnet SPL token (see scripts/create-token.ts). New wallets
 * are airdropped AIRDROP_PROOF once so they can play. Each call costs an entry
 * (cheaper in $PROOF than SOL); winners split the round pool proportional to
 * their stake. See docs/EARN.md.
 */
export const PROOF = {
  symbol: "PROOF",
  decimals: 6,

  // One-time welcome grant, minted on a wallet's first connect.
  airdrop: 1000,
  // Only the first N unique wallets to connect get the welcome airdrop.
  airdropCap: 10_000,

  // Entry to make one call. Paying in $PROOF is the discounted path; paying in
  // SOL is a real transfer and buys a bigger share of the pool.
  entryProof: 5, // $PROOF per call (the 50%-off path)
  entrySol: 0.0005, // SOL per call (real on-chain transfer)
  solPoolShare: 2, // a SOL entry counts as this many $PROOF-stakes in the pool

  // House rake on each pool, in basis points (0 = none, fully returned to winners).
  rakeBps: 0,

  // Win reward schedule. A correct call pays `base` $PROOF, plus `streakStep` for
  // each call in the current streak, capped at `streakStepCap` steps. These are
  // minted as REAL devnet $PROOF to the winner's wallet (see /api/reward/win), so
  // the server clamps any claimed amount to `maxWin` before minting.
  reward: {
    base: 50,
    streakStep: 15,
    streakStepCap: 6,
  },
} as const;

/** Reward for a correct call at a given (post-win) streak, in whole $PROOF. */
export function winReward(streak: number): number {
  const steps = Math.min(Math.max(streak - 1, 0), PROOF.reward.streakStepCap);
  return PROOF.reward.base + steps * PROOF.reward.streakStep;
}

/** The largest reward a single correct call can ever pay (the server-side clamp). */
export const MAX_WIN = PROOF.reward.base + PROOF.reward.streakStepCap * PROOF.reward.streakStep;

export const PROOF_DECIMALS = PROOF.decimals;
