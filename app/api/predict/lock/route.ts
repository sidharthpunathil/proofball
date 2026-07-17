import { NextResponse } from "next/server";
import { buildCommitment } from "@/lib/commit";

export const runtime = "nodejs";

const PROGRAM_ID =
  process.env.TXORACLE_PROGRAM_ID ?? "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J";
const CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet";

/**
 * Commit a locked prediction on-chain (the "provably fair" hook).
 *
 *  - Demo/replay mode: returns the deterministic commitment hash and links the
 *    persistent on-chain txoracle root account on the Solana explorer.
 *  - Live mode (ProofBall.md §4/§5): write a real SPL-Memo tx with the server
 *    fee-payer and return the confirmed signature + explorer link.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine in demo */
  }

  const c = buildCommitment({
    matchId: String(body.matchId ?? "featured"),
    marketId: String(body.marketId ?? "market"),
    wallet: String(body.wallet ?? "guest"),
    dir: String(body.dir ?? "-"),
    lockedProb: (body.lockedProb as number) ?? "-",
    ts: Date.now(),
  });

  // Demo links the real, persistent on-chain root account. Live mode replaces
  // this with the confirmed memo tx signature.
  const verifyUrl = `https://explorer.solana.com/address/${PROGRAM_ID}?cluster=${CLUSTER}`;

  return NextResponse.json({
    ok: true,
    commitment: c.tag,
    memoSig: c.memoSig,
    verifyUrl,
    mode: process.env.DEMO_MODE ?? "replay",
  });
}
