import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { mintProof, proofBalance, proofMint, explorerTx } from "@/lib/token";
import { getRedis, rateLimit, clientIp } from "@/lib/redis";
import { resolveWallet } from "@/lib/auth";
import { PROOF } from "@/lib/economy";
import { recordAirdrop, getAirdropRecord } from "@/lib/airdrops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// SET of wallets that have claimed a welcome-airdrop slot (also counts the cap).
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
 * wallet. Idempotent across THREE independent guards, because the mint is real
 * on-chain value and a single flag is not enough:
 *   1. Atomic SADD claim (below): the same wallet can't claim two slots, even
 *      under concurrent calls.
 *   2. On-chain balance gate: we never mint to a wallet that already holds the
 *      airdrop. This is the DURABLE source of truth — it survives a wiped Redis
 *      SET and a prior mint that landed on-chain but timed out on confirmation.
 *   3. Error handling that never re-opens a landed mint: on a mint error we
 *      re-read the balance and only release the slot when nothing was minted.
 * (2)+(3) close the double-airdrop bug: the old code did `srem` on any error,
 * so a confirmation timeout on a mint that actually landed freed the slot and a
 * reconnect minted a second time.
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
    // Backfill the ledger for wallets that were airdropped before we kept records,
    // so reconnecting an old wallet still lands it in the audit trail exactly once.
    if (balance >= PROOF.airdrop && !(await getAirdropRecord(wallet))) {
      await recordAirdrop({
        wallet,
        amount: PROOF.airdrop,
        position: null,
        ts: Date.now(),
        signature: null,
        status: "already-funded",
        balance,
      });
    }
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

  // DURABLE guard (source of truth): never mint to a wallet that already holds the
  // airdrop. On-chain balance survives a wiped Redis SET AND a prior mint that landed
  // on-chain but timed out on confirmation — both of which previously let the same
  // wallet be airdropped a second time. (This wallet just claimed a fresh SADD slot,
  // so an existing balance means the SET didn't remember it — fund-once still holds.)
  const prior = await proofBalance(wallet);
  if (prior >= PROOF.airdrop) {
    await recordAirdrop({
      wallet,
      amount: PROOF.airdrop,
      position,
      ts: Date.now(),
      signature: null,
      status: "already-funded",
      balance: prior,
    });
    return NextResponse.json({
      airdropped: false,
      alreadyFunded: true,
      amount: PROOF.airdrop,
      balance: prior,
    });
  }

  try {
    const signature = await mintProof(wallet, PROOF.airdrop);
    const balance = await proofBalance(wallet);
    await recordAirdrop({
      wallet,
      amount: PROOF.airdrop,
      position,
      ts: Date.now(),
      signature,
      status: "airdropped",
      balance,
    });
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
    // A mint that THREW may still have LANDED on-chain: spl-token confirms against a
    // blockhash window that can lapse while the tx confirms a moment later. Re-read the
    // balance before deciding. If the airdrop is there, KEEP the claim and record it —
    // do NOT `srem` (removing it is exactly what let a reconnect mint a second 1000).
    // Only release the slot when nothing landed, so a genuine pre-mint failure (e.g.
    // fee-payer out of SOL) can still be retried without ever double-minting.
    let landed = 0;
    try {
      landed = await proofBalance(wallet);
    } catch {
      /* if we can't read the balance, assume it may have landed and keep the slot */
      landed = PROOF.airdrop;
    }
    if (landed >= PROOF.airdrop) {
      await recordAirdrop({
        wallet,
        amount: PROOF.airdrop,
        position,
        ts: Date.now(),
        signature: null,
        status: "landed-late",
        balance: landed,
      });
      return NextResponse.json({
        airdropped: true,
        amount: PROOF.airdrop,
        position,
        cap: PROOF.airdropCap,
        balance: landed,
        note: "confirmation timed out but the airdrop landed on-chain",
      });
    }
    // Nothing was minted → safe to release the slot for a real retry.
    try {
      await r.srem(KEY, wallet);
    } catch {
      /* ignore */
    }
    const msg = e instanceof Error ? e.message : "airdrop failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
