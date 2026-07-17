import { NextResponse } from "next/server";
import { submitScore, topLeaders, getUserScore } from "@/lib/leaderboard";
import { rateLimit, clientIp } from "@/lib/redis";
import { resolveWallet, authRequired } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sanity ceiling for a leaderboard total. Real totals come from the airdrop
// (1000) + pool winnings and stay modest; anything past this is forged input.
const MAX_COINS = 1_000_000_000;

/**
 * GET  /api/leaderboard          → { rows }        top players (shared, from Redis)
 * GET  /api/leaderboard?name=X   → { rows, me }    also the caller's stored points
 * POST /api/leaderboard          → persist { name, coins, streak }
 */
export async function GET(req: Request) {
  const name = new URL(req.url).searchParams.get("name")?.trim();
  const [rows, me] = await Promise.all([
    topLeaders(10),
    name ? getUserScore(name) : Promise.resolve(null),
  ]);
  return NextResponse.json({ rows, me });
}

export async function POST(req: Request) {
  // Bound write spam. NOTE: this route is still keyed on an unauthenticated,
  // publicly-visible display name — a caller can only be prevented from *overwriting
  // another player's* record by binding writes to a verified wallet identity (see
  // docs/SECURITY-AUDIT.md, Finding 3). Rate limiting + clamping below reduces abuse
  // but is not a substitute for that.
  if (!(await rateLimit(`lb:ip:${clientIp(req)}`, 30, 60))) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* empty body ignored */
  }

  // With AUTH_REQUIRED on, require a verified wallet signature so a caller can't
  // write/overwrite another player's record; off (default) keeps demo behavior.
  const auth = await resolveWallet(body);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error ?? "unauthorized" }, { status: 401 });
  }

  const name = String(body.name ?? "").trim().slice(0, 24);
  const rawCoins = Number(body.coins);
  const rawStreak = Number(body.streak);
  // Clamp to a sane, non-negative integer range so forged negative/huge/NaN
  // values can't poison the shared ZSET.
  const coins = Number.isFinite(rawCoins) ? Math.min(MAX_COINS, Math.max(0, Math.round(rawCoins))) : NaN;
  const streak = Number.isFinite(rawStreak) ? Math.min(10_000, Math.max(0, Math.round(rawStreak))) : 0;
  // When enforced, key the record on the VERIFIED wallet (identity can't be spoofed);
  // otherwise fall back to the client display name (legacy demo behavior).
  const identity = authRequired() ? auth.wallet : name;
  if (identity && Number.isFinite(coins)) await submitScore(identity, coins, streak);
  return NextResponse.json({ ok: true });
}
