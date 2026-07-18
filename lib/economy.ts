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

  // The single playable $PROOF balance every new player starts with. "$PROOF is
  // the game": this is the off-chain, instant, no-signature ledger the whole game
  // runs on (the "arcade token" model) — calls move it immediately, the
  // leaderboard ranks by it, and it is the ONE $PROOF number shown across the app.
  // Cashing out (see `cashout`) mints an equal amount of REAL on-chain $PROOF into
  // the player's own wallet.
  start: 1000,

  // Entry to make one call. Paying in $PROOF is the discounted path; paying in
  // SOL is a real transfer and buys a bigger share of the pool.
  entryProof: 5, // $PROOF per call (the 50%-off path)
  entrySol: 0.0005, // SOL per call (real on-chain transfer)
  solPoolShare: 2, // a SOL entry counts as this many $PROOF-stakes in the pool

  // The leaderboard score is a play-money P&L (starts at 500, separate from the
  // on-chain $PROOF balance). Every settled call is real risk: a correct call
  // wins `winReward`, a wrong call loses `stake` (floored at 0). This is what
  // makes the score move on every call — up and down — as you play.
  stake: 20, // coins risked per call, lost on a wrong call

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

  // Cashing out moves playable $PROOF from the in-game ledger onto the chain, as a
  // real mint into the player's own wallet — the same token, just settled on-chain,
  // so the rate is 1:1. It is the one-way ledger→chain ramp (the reverse would need
  // a per-tx wallet signature, which the off-chain model exists to avoid). `min`
  // avoids dust mints that waste fee-payer SOL on ATA rent; `maxPerTx` clamps a
  // single cash-out the way `MAX_WIN` clamps a single reward.
  cashout: {
    min: 50, // smallest cash-out, in whole $PROOF
    maxPerTx: 5000, // server-side clamp on one cash-out mint
  },

  // Topping up is the reverse ramp: the player signs a real on-chain transfer of
  // $PROOF from their own wallet into the game treasury, and the server credits the
  // playable ledger by the verified amount. A deposit spends the player's own tokens
  // so it legitimately needs one wallet signature (unlike the signature-free loop).
  // `min` is a UI floor only — the server credits exactly what actually landed on
  // chain, so a deposit is never "sent but not credited".
  topup: {
    min: 50, // smallest top-up offered in the UI, in whole $PROOF
  },
} as const;

/** Reward for a correct call at a given (post-win) streak, in whole $PROOF. */
export function winReward(streak: number): number {
  const steps = Math.min(Math.max(streak - 1, 0), PROOF.reward.streakStepCap);
  return PROOF.reward.base + steps * PROOF.reward.streakStep;
}

/** The largest reward a single correct call can ever pay (the server-side clamp). */
export const MAX_WIN = PROOF.reward.base + PROOF.reward.streakStepCap * PROOF.reward.streakStep;

/** The most $PROOF a single cash-out can mint on-chain (the server-side clamp). */
export const MAX_CASHOUT = PROOF.cashout.maxPerTx;

export const PROOF_DECIMALS = PROOF.decimals;
