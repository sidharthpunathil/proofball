import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { mintProof, proofBalance, proofMint, explorerTx } from "@/lib/token";
import { rateLimit, clientIp } from "@/lib/kv";
import { PROOF, MAX_CASHOUT } from "@/lib/economy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST { wallet, amount } -> cashes out `amount` playable $PROOF by minting an
 * equal amount of REAL devnet $PROOF into the wallet, using the fee-payer mint
 * authority (the same on-chain path as a won call and the welcome airdrop).
 *
 * "$PROOF is the game": the playable balance is an off-chain ledger (the client
 * store + shared leaderboard), so the whole gameplay loop needs no signature. This
 * route is the one-way ledger→chain ramp — the debit of the playable balance
 * happens client-side (there is no server-authoritative ledger to debit here, the
 * same posture as /api/reward/win). The server's job is to bound the faucet: it
 * clamps the mint to the cash-out cap and rate-limits per wallet / IP / globally so
 * it can't be farmed to drain fee-payer SOL. Devnet, valueless — the guards bound
 * blast radius, not value at risk.
 */
export async function POST(req: Request) {
  if (!proofMint()) {
    return NextResponse.json({ error: "token not configured" }, { status: 503 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* empty body -> invalid below */
  }

  const wallet = String(body.wallet ?? "").trim();
  try {
    new PublicKey(wallet); // throws on a bad address
  } catch {
    return NextResponse.json({ error: "invalid wallet" }, { status: 400 });
  }

  // Clamp to the cash-out schedule: never mint below the minimum (dust) nor above
  // the per-tx cap. A tampered client gets the capped mint, not free rein.
  const requested = Math.floor(Number(body.amount ?? 0));
  if (!Number.isFinite(requested) || requested < PROOF.cashout.min) {
    return NextResponse.json(
      { error: `minimum cash-out is ${PROOF.cashout.min} $PROOF` },
      { status: 400 }
    );
  }
  const amount = Math.min(requested, MAX_CASHOUT);

  // Anti-farm rate limits (fail OPEN if Redis is down; the amount clamp still
  // holds). A cash-out is a deliberate, occasional action, so these are far
  // tighter than the win faucet: per-wallet AND per-IP AND a global mint budget.
  const ip = clientIp(req);
  const okWallet = await rateLimit(`cashout:wallet:${wallet}`, 60, 3600);
  const okIp = await rateLimit(`cashout:ip:${ip}`, 100, 3600);
  const okGlobal = await rateLimit("cashout:global", 2000, 3600);
  if (!okWallet || !okIp || !okGlobal) {
    return NextResponse.json({ minted: false, rateLimited: true }, { status: 429 });
  }

  try {
    const signature = await mintProof(wallet, amount);
    const balance = await proofBalance(wallet);
    return NextResponse.json({
      minted: true,
      amount,
      signature,
      explorerUrl: explorerTx(signature),
      balance,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "mint failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
