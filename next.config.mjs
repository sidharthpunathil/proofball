/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow an isolated build dir via env. Multiple `next dev` instances sharing
  // one .next corrupt each other's chunks; a second server can set
  // NEXT_DIST_DIR to run cleanly. Defaults to .next so nothing else changes.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
