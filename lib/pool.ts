import { PROOF } from "./economy";

/**
 * Parimutuel pool settlement, the heart of the game.
 *
 * Everyone who calls the correct direction splits the whole pool in proportion
 * to their stake ("based on your %"). Losers forfeit their entry to the winners.
 * A stake is measured in $PROOF-equivalent value: a $PROOF entry stakes
 * `entryProof`; a SOL entry stakes `entryProof * solPoolShare` (SOL buys a
 * bigger share, so paying in $PROOF is the cheaper path).
 *
 * See docs/EARN.md for the plain-language version and the worked example.
 */

export type Dir = "up" | "down";

export interface Entry {
  wallet: string;
  dir: Dir;
  stake: number; // $PROOF-equivalent value staked
}

export interface Payout {
  wallet: string;
  won: boolean;
  stake: number;
  payout: number; // $PROOF returned (0 if lost)
  profit: number; // payout - stake
}

export interface Settlement {
  outcome: Dir | "push";
  pool: number; // total staked
  rake: number; // taken by the house (0 by default)
  winners: number;
  refunded: boolean; // everyone refunded (push / no winners / everyone wins)
  payouts: Payout[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function settlePool(entries: Entry[], outcome: Dir | "push"): Settlement {
  const pool = round2(entries.reduce((a, e) => a + e.stake, 0));

  const refundAll = (): Settlement => ({
    outcome,
    pool,
    rake: 0,
    winners: 0,
    refunded: true,
    payouts: entries.map((e) => ({
      wallet: e.wallet,
      won: false,
      stake: e.stake,
      payout: e.stake, // money back
      profit: 0,
    })),
  });

  // No move to settle, or nothing to split fairly: give everyone their entry back.
  const winners = entries.filter((e) => e.dir === outcome);
  if (outcome === "push" || winners.length === 0 || winners.length === entries.length) {
    return refundAll();
  }

  const rake = round2((pool * PROOF.rakeBps) / 10_000);
  const distributable = pool - rake;
  const winStake = winners.reduce((a, e) => a + e.stake, 0);

  const payouts: Payout[] = entries.map((e) => {
    const won = e.dir === outcome;
    const payout = won ? round2((e.stake / winStake) * distributable) : 0;
    return { wallet: e.wallet, won, stake: e.stake, payout, profit: round2(payout - e.stake) };
  });

  return { outcome, pool, rake, winners: winners.length, refunded: false, payouts };
}
