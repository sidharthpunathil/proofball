// Baseline security headers applied to every response. NOTE: no Content-Security-Policy
// yet — the app ships an inline theme script (app/layout.tsx) and loads wallet adapters,
// so a CSP needs a nonce/hash pass to avoid breaking them. Track that as a follow-up
// (see docs/SECURITY-AUDIT.md). These headers are safe and non-breaking today.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" }, // clickjacking guard for a wallet-signing dApp
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow an isolated build dir via env. Multiple `next dev` instances sharing
  // one .next corrupt each other's chunks; a second server can set
  // NEXT_DIST_DIR to run cleanly. Defaults to .next so nothing else changes.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

// Give `next dev` local Cloudflare bindings (D1, R2, assets) via wrangler.jsonc.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
