import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { savePick, loadPicks, type PickInput } from "@/lib/picks";
import { rateLimit, clientIp } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Durable "Your calls" store, keyed by wallet.
 *   GET  /api/picks?wallet=X → { picks, earned, won, lost }  the wallet's calls
 *   POST /api/picks          → persist one settled call { wallet, pick }
 *
 * These are play-money records (the game runs off-chain, "$PROOF is the game"),
 * so like the leaderboard the trust model is light: we validate the wallet is a
 * real address, clamp the reward, and rate-limit — enough to keep the table sane
 * without a signature on every settle.
 */
function isWallet(w: string): boolean {
  try {
    new PublicKey(w);
    return true;
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const wallet = new URL(req.url).searchParams.get("wallet")?.trim() ?? "";
  if (!isWallet(wallet)) {
    return NextResponse.json({ picks: [], earned: 0, won: 0, lost: 0 });
  }
  const data = await loadPicks(wallet);
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  // Bound write spam (a call settles ~every 15s of play; this is generous).
  if (!(await rateLimit(`picks:ip:${clientIp(req)}`, 120, 60))) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* invalid below */
  }

  const wallet = String(body.wallet ?? "").trim();
  const raw = body.pick as Record<string, unknown> | undefined;
  if (!isWallet(wallet) || !raw || typeof raw.id !== "string") {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const dir = raw.dir === "up" || raw.dir === "down" ? raw.dir : null;
  const status = raw.status === "won" || raw.status === "lost" ? raw.status : null;
  if (!dir || !status) {
    return NextResponse.json({ error: "invalid pick" }, { status: 400 });
  }

  // Clamp the reward so a tampered client can't write an absurd figure.
  const rawReward = Number(raw.reward ?? 0);
  const reward = Number.isFinite(rawReward) ? Math.max(-100_000, Math.min(100_000, Math.round(rawReward))) : 0;

  const pick: PickInput = {
    id: String(raw.id),
    dir,
    status,
    atMinute: Number.isFinite(Number(raw.atMinute)) ? Math.round(Number(raw.atMinute)) : null,
    delta: Number.isFinite(Number(raw.delta)) ? Number(raw.delta) : null,
    reward,
    fixtureId: typeof raw.fixtureId === "string" ? raw.fixtureId : null,
    verifyUrl: typeof raw.verifyUrl === "string" ? raw.verifyUrl : null,
    createdAt: Number.isFinite(Number(raw.createdAt)) ? Number(raw.createdAt) : Date.now(),
    settledAt: Number.isFinite(Number(raw.settledAt)) ? Number(raw.settledAt) : Date.now(),
  };

  await savePick(wallet, pick);
  return NextResponse.json({ ok: true });
}
