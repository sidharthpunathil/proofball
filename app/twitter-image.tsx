import { renderDefaultOgImage, OG_SIZE, OG_CONTENT_TYPE, OG_ALT } from "@/lib/og/default-card";

// Twitter/X large summary card. Reuses the same branded 1200×630 render as the
// OpenGraph card so previews are identical across platforms.
export const runtime = "nodejs";
export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function TwitterImage() {
  return renderDefaultOgImage();
}
