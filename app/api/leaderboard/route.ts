import { NextResponse } from "next/server";
import { submitScore, topLeaders, getUserScore } from "@/lib/leaderboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* empty body ignored */
  }
  const name = String(body.name ?? "").trim().slice(0, 24);
  const coins = Number(body.coins);
  const streak = Number(body.streak) || 0;
  if (name && Number.isFinite(coins)) await submitScore(name, coins, streak);
  return NextResponse.json({ ok: true });
}
