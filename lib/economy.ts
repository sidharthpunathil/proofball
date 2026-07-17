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
} as const;

export const PROOF_DECIMALS = PROOF.decimals;
