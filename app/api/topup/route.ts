import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { connection, proofMint, treasuryOwner } from "@/lib/token";
import { rateLimit, clientIp } from "@/lib/kv";
import { getDb } from "@/lib/d1";
import { PROOF, PROOF_DECIMALS } from "@/lib/economy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = 10 ** PROOF_DECIMALS;

/**
 * Top up: the reverse of cash-out. The player signs a real on-chain transfer of
 * $PROOF from their own wallet into the game treasury (the fee-payer's associated
 * token account); this route VERIFIES that transfer on-chain and reports how much
 * to credit to the off-chain playable ledger.
 *
 * GET  -> { treasury, mint, min } so the client knows where to send the deposit.
 * POST { wallet, signature } -> looks up the confirmed transaction, checks it is a
 *   $PROOF transfer FROM `wallet` TO the treasury ATA, derives the amount FROM THE
 *   CHAIN (never trusts a client-claimed amount), and guards against double-credit
 *   with a one-shot signature set. Unlike cash-out, this direction is trust-minimised
 *   — the credit is only as large as what actually landed on chain.
 *   Returns { ok, credited } on success, { pending:true } (202) if the tx is not yet
 *   visible (client retries), or an error.
 */
export async function GET() {
  const treasury = treasuryOwner();
  const mint = proofMint();
  if (!treasury || !mint) {
    return NextResponse.json({ error: "token not configured" }, { status: 503 });
  }
  return NextResponse.json({
    treasury: treasury.toBase58(),
    mint: mint.toBase58(),
    min: PROOF.topup.min,
  });
}

export async function POST(req: Request) {
  const mint = proofMint();
  const treasury = treasuryOwner();
  if (!mint || !treasury) {
    return NextResponse.json({ error: "token not configured" }, { status: 503 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* invalid below */
  }

  const wallet = String(body.wallet ?? "").trim();
  const signature = String(body.signature ?? "").trim();
  try {
    new PublicKey(wallet);
  } catch {
    return NextResponse.json({ error: "invalid wallet" }, { status: 400 });
  }
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  // Anti-abuse: verifying a deposit reads the chain; a deposit is a deliberate,
  // occasional action, so bound the lookup rate per wallet / IP (fail open).
  const ip = clientIp(req);
  const okWallet = await rateLimit(`topup:wallet:${wallet}`, 60, 3600);
  const okIp = await rateLimit(`topup:ip:${ip}`, 120, 3600);
  if (!okWallet || !okIp) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  const treasuryAta = (await getAssociatedTokenAddress(mint, treasury)).toBase58();

  let tx;
  try {
    tx = await connection().getParsedTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
  } catch {
    return NextResponse.json({ pending: true }, { status: 202 });
  }
  // Not visible yet — the client just sent it; ask them to retry shortly.
  if (!tx) return NextResponse.json({ pending: true }, { status: 202 });
  if (tx.meta?.err) {
    return NextResponse.json({ error: "the transfer failed on-chain" }, { status: 400 });
  }

  // Find a $PROOF transfer FROM the caller TO the treasury ATA. transferChecked
  // carries the mint + decimals; the older `transfer` does not, but its destination
  // is the treasury's mint-specific ATA, so the mint is implied by the account.
  const mintStr = mint.toBase58();
  let creditedBase = 0n;
  for (const ix of tx.transaction.message.instructions) {
    if (!("parsed" in ix) || ix.program !== "spl-token") continue;
    const parsed = ix.parsed as { type?: string; info?: Record<string, unknown> } | undefined;
    if (!parsed?.info) continue;
    if (parsed.type !== "transferChecked" && parsed.type !== "transfer") continue;
    const info = parsed.info;
    if (info.destination !== treasuryAta) continue;
    if (info.authority !== wallet) continue; // the source's owner must be the caller
    if (parsed.type === "transferChecked") {
      if (info.mint !== mintStr) continue;
      const amt = (info.tokenAmount as { amount?: string })?.amount;
      creditedBase = BigInt(amt ?? "0");
    } else {
      creditedBase = BigInt(String(info.amount ?? "0"));
    }
    break;
  }

  if (creditedBase <= 0n) {
    return NextResponse.json(
      { error: "no matching $PROOF deposit found in that transaction" },
      { status: 400 }
    );
  }

  // Idempotency: credit a given signature at most once. The insert changes one row
  // the first time and none after that. Fail closed if the database is unavailable,
  // we must never risk a double-credit of a valid on-chain deposit.
  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: "top-up tracking unavailable" }, { status: 503 });
  }
  let firstTime: number;
  try {
    const res = await db
      .prepare("INSERT OR IGNORE INTO topups (signature, created_at) VALUES (?1, ?2)")
      .bind(signature, Date.now())
      .run();
    firstTime = res.meta.changes;
  } catch {
    return NextResponse.json({ error: "top-up tracking unavailable" }, { status: 503 });
  }
  if (firstTime === 0) {
    return NextResponse.json({ error: "this deposit was already credited" }, { status: 409 });
  }

  const credited = Number(creditedBase) / BASE;
  return NextResponse.json({ ok: true, credited });
}
