import { ImageResponse } from "next/og";

export const runtime = "nodejs";

/**
 * "I called it" share card, clean, light, no gradient.
 *   /api/og?result=won&pick=up&delta=8.2&streak=3&home=FRA&away=SWE
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const won = (searchParams.get("result") ?? "won") === "won";
  const pick = searchParams.get("pick") === "down" ? "Falling" : "Rising";
  const delta = searchParams.get("delta") ?? "0";
  const streak = searchParams.get("streak") ?? "0";
  const home = searchParams.get("home") ?? "FRA";
  const away = searchParams.get("away") ?? "SWE";

  const ink = "#0c0c0e";
  const mut = "#8e8e94";
  const accent = won ? "#12b36a" : "#f04438";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "70px",
          background: "#f4f4f7",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 34, fontWeight: 800, color: ink }}>
            <div style={{ width: 30, height: 30, borderRadius: 30, background: "#12b36a" }} />
            ProofBall
          </div>
          <div style={{ display: "flex", fontSize: 26, color: mut, fontWeight: 600 }}>
            {home} vs {away}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 32, color: mut, display: "flex" }}>{won ? "I called it." : "So close."}</div>
          <div style={{ fontSize: 118, fontWeight: 800, letterSpacing: "-4px", color: ink, lineHeight: 1.05, display: "flex" }}>
            {won ? "Called it" : "Missed"}
          </div>
          <div style={{ fontSize: 38, color: ink, marginTop: 14, display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ display: "flex", padding: "6px 20px", borderRadius: 100, background: accent, color: "#fff", fontWeight: 700, fontSize: 30 }}>
              {pick}
            </span>
            <span style={{ display: "flex", color: mut }}>
              win-prob moved {Number(delta) > 0 ? "+" : ""}
              {delta}%
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 32, color: ink, fontWeight: 700 }}>{streak} streak</div>
          <div style={{ display: "flex", alignItems: "center", padding: "12px 28px", borderRadius: 100, background: ink, color: "#fff", fontSize: 26, fontWeight: 600 }}>
            Verified on Solana
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
