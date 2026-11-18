/**
 * Single source of truth for the site's public identity and canonical origin.
 * Metadata (app/layout.tsx), the OG image, robots.ts and sitemap.ts all read
 * from here so the brand copy and URLs never drift apart.
 */

function normalizeOrigin(raw: string): string {
  const withProtocol = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/+$/, ""); // strip trailing slashes
}

/**
 * Canonical origin, resolved in priority order:
 *   1. NEXT_PUBLIC_SITE_URL — explicit override (set this in prod).
 *   2. proofball.xyz — the production fallback.
 */
export const SITE_URL: string = normalizeOrigin(
  process.env.NEXT_PUBLIC_SITE_URL || "proofball.xyz",
);

export const SITE_NAME = "ProofBall";

export const SITE_TAGLINE = "Momentum trading for your favorite sports";

export const SITE_DESCRIPTION =
  "Momentum trading for your favorite sports. Call which way the live win-probability swings during the match; every result is settled against on-chain data, so the house can't cheat. Free to play. Built on TxLINE + Solana.";

/** Short blurb for cards where the full description is too long. */
export const SITE_DESCRIPTION_SHORT =
  "Call which way the live win-probability swings. Every result settled on-chain, so no one can cheat.";

export const SITE_KEYWORDS = [
  "ProofBall",
  "momentum trading",
  "sports prediction",
  "live football",
  "win probability",
  "prediction market",
  "provably fair",
  "on-chain",
  "Solana",
  "TxLINE",
  "TxOdds",
  "World Cup",
  "second screen",
  "$PROOF",
];

/** Absolute URL helper for building canonical / OG links from a path. */
export function absoluteUrl(path = "/"): string {
  return new URL(path, SITE_URL).toString();
}
