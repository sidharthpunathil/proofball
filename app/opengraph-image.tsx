import { renderDefaultOgImage, OG_SIZE, OG_CONTENT_TYPE, OG_ALT } from "@/lib/og/default-card";

// Default OpenGraph card for the whole site. Next.js auto-wires this into the
// <meta property="og:image"> for every route that doesn't override it.
export const runtime = "nodejs";
export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpengraphImage() {
  return renderDefaultOgImage();
}
