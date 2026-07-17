import { NextResponse } from "next/server";
import { listAirdrops } from "@/lib/airdrops";
import { PROOF } from "@/lib/economy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/airdrops -> the full welcome-airdrop ledger: who received the
 * one-time $PROOF airdrop, how much, their spot in the first N, the mint tx, and
 * when. Also returns totals so you can reconcile fee-payer spend.
 *
 * Guarded by the ADMIN_TOKEN secret — pass it as an `x-admin-token` header or a
 * `?token=` query param. When ADMIN_TOKEN is unset the route 404s, so it stays
 * invisible in the default demo rather than exposing the ledger publicly.
 */
export async function GET(req: Request) {
  const admin = process.env.ADMIN_TOKEN?.trim();
  if (!admin) return NextResponse.json({ error: "not found" }, { status: 404 });

  const url = new URL(req.url);
  const got = (req.headers.get("x-admin-token") ?? url.searchParams.get("token") ?? "").trim();
  if (got !== admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const records = await listAirdrops();
  const minted = records.filter((r) => r.status === "airdropped" || r.status === "landed-late");
  const totalProof = minted.reduce((s, r) => s + (r.amount || 0), 0);

  return NextResponse.json({
    count: records.length, // wallets in the ledger
    mintedCount: minted.length, // wallets we actually minted to
    totalProof, // total $PROOF minted as airdrops
    airdrop: PROOF.airdrop,
    cap: PROOF.airdropCap,
    records,
  });
}
