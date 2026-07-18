import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { mintProof, proofBalance, proofMint, explorerTx } from "@/lib/token";
import { rateLimit, clientIp } from "@/lib/redis";
import { MAX_WIN } from "@/lib/economy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST { wallet, amount } -> mints the winnings of a correct call as REAL devnet
 * $PROOF to the wallet, using the fee-payer mint authority (same path as the
 * welcome airdrop). This is what makes a finished-match "replay" real play: a
 * right call actually pays out on-chain, verifiable on the Solana explorer.
 *
 * Settlement is computed client-side, so the server cannot re-derive the win.
 * It instead (a) clamps `amount` to the known reward schedule so a client can
 * never claim more than one call can pay, and (b) rate-limits per wallet / IP /
 * globally so the mint faucet can't be farmed to drain fee-payer SOL. These are
 * devnet (valueless) tokens; the guards bound blast radius, not value at risk.
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

  // Clamp to the reward schedule: never mint more than a single call can pay, and
  // never a non-positive amount. A tampered client gets the capped mint, not free rein.
  const requested = Math.floor(Number(body.amount ?? 0));
  if (!Number.isFinite(requested) || requested <= 0) {
    return NextResponse.json({ error: "nothing to mint" }, { status: 400 });
  }
  const amount = Math.min(requested, MAX_WIN);

  // Anti-farm rate limits (fail OPEN if Redis is down; the amount clamp still holds).
  // Sized to allow continuous real play (a call settles roughly every ~15s) while
  // capping automated bursts. Per-wallet AND per-IP AND a global mint budget.
  const ip = clientIp(req);
  // The three limits are independent, so issue them in one round-trip instead of
  // three sequential Redis hops on the hot settle path (a call settles ~every 15s).
  const [okWallet, okIp, okGlobal] = await Promise.all([
    rateLimit(`win:wallet:${wallet}`, 300, 3600),
    rateLimit(`win:ip:${ip}`, 400, 3600),
    rateLimit("win:global", 5000, 3600),
  ]);
  if (!okWallet || !okIp || !okGlobal) {
    // Don't fail the call — the leaderboard points already counted client-side;
    // the on-chain top-up is just skipped for this one until the window resets.
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
