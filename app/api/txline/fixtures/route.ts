import { NextResponse } from "next/server";
import { getFixtures } from "@/lib/txline-fixtures";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Real TxLINE World Cup knockout fixtures for the lobby:
 * finished semi-finals (real scores) + the upcoming final (real odds %).
 * All numbers come from the TxLINE API, see docs/DATA.md.
 */
export async function GET() {
  const fixtures = await getFixtures();
  return NextResponse.json(
    { fixtures },
    { headers: { "Cache-Control": "no-store" } }
  );
}
