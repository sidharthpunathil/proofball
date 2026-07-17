import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { mintProof, proofBalance, proofMint, explorerTx } from "@/lib/token";
import { getRedis, rateLimit, clientIp } from "@/lib/redis";
import { resolveWallet } from "@/lib/auth";
import { PROOF } from "@/lib/economy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// SET of wallets that already received the welcome airdrop (once per wallet).
const KEY = "proofball:airdropped";

/** GET /api/reward/airdrop?wallet=X -> the wallet's on-chain $PROOF balance. */
export async function GET(req: Request) {
  const wallet = new URL(req.url).searchParams.get("wallet")?.trim();
  const mint = proofMint()?.toBase58() ?? null;
  if (!wallet) return NextResponse.json({ mint, balance: 0 });
  const balance = await proofBalance(wallet);
  return NextResponse.json({ mint, balance });
}

/**
 * POST { wallet } -> mints the one-time welcome airdrop of $PROOF to a fresh
 * wallet. Idempotent: `sadd` returns 1 only the first time, so a wallet can
 * never be airdropped twice even under concurrent calls.
 */
export async function POST(req: Request) {
  if (!proofMint()) {
    return NextResponse.json({ error: "token not configured" }, { status: 503 });
  }
  const r = getRedis();
  if (!r) {
    return NextResponse.json({ error: "airdrop tracking unavailable" }, { status: 503 });
  }

  // Anti-abuse: mints spend real (fee-payer) SOL on ATA rent + can farm $PROOF to
  // freshly generated wallets. The per-wallet SADD guard below only blocks the SAME
  // wallet twice — it does nothing against Sybil addresses — so bound the burst rate
  // per source IP AND globally per hour. (Not a substitute for wallet-ownership proof;
  // it caps the blast radius of an unauthenticated caller.)
  const ip = clientIp(req);
  if (!(await rateLimit(`airdrop:ip:${ip}`, 5, 3600))) {
    return NextResponse.json({ error: "rate limited, try later" }, { status: 429 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* empty body -> invalid below */
  }
  // Resolve caller identity. With AUTH_REQUIRED on, this verifies a wallet
  // signature (SIWS) and rejects unproven callers — closing Sybil farming; with
  // the flag off (default) it trusts body.wallet as before so the demo is unaffected.
  const auth = await resolveWallet(body);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error ?? "unauthorized" }, { status: 401 });
  }
  const wallet = auth.wallet;
  try {
    new PublicKey(wallet); // throws on a bad address
  } catch {
    return NextResponse.json({ error: "invalid wallet" }, { status: 400 });
  }

  // Atomic: add to the set and get this wallet's 1-indexed position, or -1 if it
  // was already present. Running SADD + SCARD in one Lua call makes the cap check
  // race-free, since Redis executes the whole script atomically.
  const CLAIM = `local added = redis.call('SADD', KEYS[1], ARGV[1])
if added == 0 then return -1 end
return redis.call('SCARD', KEYS[1])`;
  let position: number;
  try {
    position = Number(await r.eval(CLAIM, 1, KEY, wallet));
  } catch {
    return NextResponse.json({ error: "airdrop tracking unavailable" }, { status: 503 });
  }

  if (position === -1) {
    // Already processed once (airdropped, or already counted past the cap). Never repeat.
    const balance = await proofBalance(wallet);
    return NextResponse.json({ airdropped: false, amount: PROOF.airdrop, balance });
  }
  if (position > PROOF.airdropCap) {
    // Past the first N users: no free grant. The wallet stays counted so it will not
    // retry, and it can still connect and play, just without the airdrop.
    return NextResponse.json({ airdropped: false, capReached: true, cap: PROOF.airdropCap });
  }

  // Global mint-budget ceiling: bounds how much fee-payer SOL an attacker can burn
  // per hour even across many IPs. Counted only for real mint attempts.
  if (!(await rateLimit("airdrop:global", 300, 3600))) {
    // Release the slot so a genuine user can still claim once the window resets.
    try {
      await r.srem(KEY, wallet);
    } catch {
      /* ignore */
    }
    return NextResponse.json({ error: "airdrop temporarily paused, try later" }, { status: 429 });
  }

  try {
    const signature = await mintProof(wallet, PROOF.airdrop);
    const balance = await proofBalance(wallet);
    return NextResponse.json({
      airdropped: true,
      amount: PROOF.airdrop,
      position, // this wallet's spot in the first N
      cap: PROOF.airdropCap,
      signature,
      explorerUrl: explorerTx(signature),
      balance,
    });
  } catch (e) {
    // Roll back so the user can retry and the slot is not consumed.
    try {
      await r.srem(KEY, wallet);
    } catch {
      /* ignore */
    }
    const msg = e instanceof Error ? e.message : "airdrop failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
