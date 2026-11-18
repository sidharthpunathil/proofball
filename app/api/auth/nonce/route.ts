import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { issueNonce, siwsMessage, authRequired } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST { wallet } -> { nonce, message, authRequired }
 *
 * Step 1 of Sign-In-With-Solana: the client requests a single-use nonce, signs
 * the returned `message` with the wallet, then sends { wallet, nonce, signature }
 * to a mutating route (airdrop / leaderboard). See lib/siws-client.ts.
 */
export async function POST(req: Request) {
  if (!(await rateLimit(`nonce:ip:${clientIp(req)}`, 30, 60))) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* invalid below */
  }
  const wallet = String(body.wallet ?? "").trim();
  try {
    new PublicKey(wallet);
  } catch {
    return NextResponse.json({ error: "invalid wallet" }, { status: 400 });
  }
  const nonce = await issueNonce(wallet);
  if (!nonce) return NextResponse.json({ error: "auth unavailable" }, { status: 503 });
  return NextResponse.json({ nonce, message: siwsMessage(wallet, nonce), authRequired: authRequired() });
}
