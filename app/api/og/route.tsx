import { ImageResponse } from "next/og";
import { publicFileDataUri } from "@/lib/static-asset";

export const runtime = "nodejs";

/**
 * The "I called it" share card, 1200x630, in the app's own dark look. The
 * earnings are the hero: a huge +140 $PROOF, then the call itself (direction,
 * match minute, prob move, streak) as chips, then the fairness line. Rendered
 * with real brand assets read from /public.
 *
 *   /api/og?result=won&pick=up&delta=8.2&reward=140&min=78&streak=3&home=ESP&away=ARG
 */

// Brand assets as data URIs, read once per server. Satori accepts data: images.
let assets: Promise<{ logo: string; mark: string }> | null = null;
function loadAssets() {
  if (!assets) {
    assets = Promise.all([
      publicFileDataUri("proofball-logo.png"),
      publicFileDataUri("proof-mark.png"),
    ])
      .then(([logo, mark]) => ({ logo, mark }))
      .catch((e) => {
        assets = null; // retry on the next request instead of caching the failure
        throw e;
      });
  }
  return assets;
}

// The app's dark-theme palette (globals.css [data-theme=dark]).
const BG = "#101116";
const SURFACE = "#191a21";
const INK = "#f4f4f6";
const INK2 = "#b8b9c1";
const MUT = "#8e8f98";
const LINE = "rgba(255,255,255,0.09)";
const GRN = "#2dd682";
const GRNSOFT = "#122a1f";
const RED = "#f0685a";
const REDSOFT = "#321a1a";
const AMBER = "#f0b242";

function Chip({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 26px",
        borderRadius: 100,
        background: bg,
        color,
        fontSize: 30,
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const won = (searchParams.get("result") ?? "won") === "won";
  const up = searchParams.get("pick") !== "down";
  const delta = Number(searchParams.get("delta") ?? 0);
  const reward = Math.abs(Number(searchParams.get("reward") ?? 0)) || (won ? 50 : 0);
  const min = searchParams.get("min");
  const streak = Number(searchParams.get("streak") ?? 0);
  const home = (searchParams.get("home") ?? "ESP").slice(0, 3).toUpperCase();
  const away = (searchParams.get("away") ?? "ARG").slice(0, 3).toUpperCase();
  const { logo, mark } = await loadAssets();

  const accent = won ? GRN : RED;
  // A real SVG triangle: the ▲/▼ glyphs aren't in Satori's bundled font and
  // would render as tofu boxes.
  const dirArrow = (
    <svg width="22" height="22" viewBox="0 0 20 20">
      <polygon
        points={up ? "10,3 18,16 2,16" : "10,17 18,4 2,4"}
        fill={up ? GRN : RED}
      />
    </svg>
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: BG,
          backgroundImage: `radial-gradient(900px 500px at 85% -10%, rgba(45,214,130,0.14), transparent 60%)`,
          fontFamily: "sans-serif",
        }}
      >
        {/* header: brand | fixture */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} width={64} height={64} style={{ borderRadius: 18 }} alt="" />
            <div style={{ display: "flex", fontSize: 40, fontWeight: 800, color: INK, letterSpacing: "-1px" }}>
              ProofBall
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 26px",
              borderRadius: 100,
              border: `2px solid ${LINE}`,
              background: SURFACE,
              fontSize: 28,
              color: INK2,
              fontWeight: 700,
            }}
          >
            {home} vs {away} · World Cup
          </div>
        </div>

        {/* hero: the earnings */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", fontSize: 36, color: MUT, fontWeight: 600 }}>
            {won ? "I called it." : "The market got me."}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mark} width={84} height={84} alt="" />
            <div
              style={{
                display: "flex",
                fontSize: 150,
                fontWeight: 800,
                letterSpacing: "-6px",
                lineHeight: 1,
                color: accent,
              }}
            >
              {won ? "+" : "−"}
              {reward.toLocaleString()}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 54,
                fontWeight: 800,
                color: INK,
                letterSpacing: "-1px",
                marginTop: 34,
              }}
            >
              $PROOF
            </div>
          </div>

          {/* the call, as chips */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 30 }}>
            <Chip color={up ? GRN : RED} bg={up ? GRNSOFT : REDSOFT}>
              {dirArrow}
              {up ? "Rising" : "Falling"}
            </Chip>
            {min != null && min !== "" && (
              <Chip color={INK2} bg={SURFACE}>
                {min}&apos; in the match
              </Chip>
            )}
            {Math.abs(delta) >= 0.1 && (
              <Chip color={delta > 0 ? GRN : RED} bg={SURFACE}>
                {delta > 0 ? "+" : ""}
                {delta.toFixed(1)}% move
              </Chip>
            )}
            {streak >= 2 && (
              <Chip color={AMBER} bg="rgba(240,178,66,0.14)">
                {"🔥"} {streak} in a row
              </Chip>
            )}
          </div>
        </div>

        {/* footer: fairness | url */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 27, color: MUT, fontWeight: 600 }}>
            <div style={{ display: "flex", width: 14, height: 14, borderRadius: 14, background: GRN }} />
            Every call settles against on-chain World Cup data
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "12px 30px",
              borderRadius: 100,
              background: INK,
              color: BG,
              fontSize: 28,
              fontWeight: 800,
            }}
          >
            proofball.xyz
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
