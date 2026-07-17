import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE, SITE_DESCRIPTION_SHORT } from "@/lib/site";

/**
 * The default 1200×630 social card, used for the site's OpenGraph and Twitter
 * previews (app/opengraph-image.tsx + app/twitter-image.tsx). Pure CSS so it
 * renders fast with no bundled image; colours track the app's dark theme
 * (see app/globals.css). Per-result "I called it" cards live in /api/og.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";
export const OG_ALT = `${SITE_NAME} — ${SITE_TAGLINE}`;

// Dark-theme tokens (rgb triplets from globals.css) as hex.
const BG = "#0e0f14";
const INK = "#f5f5f8";
const MUT = "#82848e";
const INK2 = "#a2a4ae";
const GRN = "#2dd682";
const LINE = "#262832";

export function renderDefaultOgImage(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background: BG,
          // soft green glow, top-left, so the flat card has depth
          backgroundImage: `radial-gradient(900px 500px at 12% -8%, rgba(45,214,130,0.16), rgba(45,214,130,0) 60%)`,
          fontFamily: "sans-serif",
        }}
      >
        {/* top row: brand + competition pill */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div
              style={{
                display: "flex",
                width: 64,
                height: 64,
                borderRadius: 20,
                background: GRN,
                boxShadow: "0 8px 30px rgba(45,214,130,0.35)",
              }}
            />
            <div style={{ display: "flex", fontSize: 44, fontWeight: 800, letterSpacing: "-1px", color: INK }}>
              {SITE_NAME}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              padding: "10px 24px",
              borderRadius: 100,
              border: `1px solid ${LINE}`,
              color: INK2,
              fontSize: 26,
              fontWeight: 600,
            }}
          >
            World Cup
          </div>
        </div>

        {/* headline */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 88,
              fontWeight: 800,
              letterSpacing: "-3px",
              lineHeight: 1.02,
              color: INK,
              maxWidth: 980,
            }}
          >
            {SITE_TAGLINE}.
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 28,
              fontSize: 34,
              lineHeight: 1.35,
              color: MUT,
              maxWidth: 880,
            }}
          >
            {SITE_DESCRIPTION_SHORT}
          </div>
        </div>

        {/* bottom row: built-on + verified pill */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 600, color: MUT }}>
            Built on TxLINE · Solana
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "14px 30px",
              borderRadius: 100,
              background: GRN,
              color: "#04120a",
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            <div style={{ display: "flex", width: 14, height: 14, borderRadius: 14, background: "#04120a" }} />
            Verified on-chain
          </div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
