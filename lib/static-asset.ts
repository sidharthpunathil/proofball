import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Fetcher } from "@cloudflare/workers-types";

/**
 * Read a file from /public as a base64 data URI (Satori only takes data: images).
 *
 * On Cloudflare Workers there is no filesystem, so the file is fetched through
 * the static-assets binding. Under plain Node (next build prerendering, tests)
 * it falls back to reading the file from disk.
 */
export async function publicFileDataUri(file: string, mime = "image/png"): Promise<string> {
  const bytes = await readPublicFile(file);
  return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
}

async function readPublicFile(file: string): Promise<ArrayBuffer> {
  try {
    const env = getCloudflareContext().env as { ASSETS?: Fetcher };
    if (env.ASSETS) {
      const res = await env.ASSETS.fetch(new URL(`/${file}`, "https://assets.local"));
      if (res.ok) return await res.arrayBuffer();
    }
  } catch {
    /* not on Workers: fall through to the filesystem */
  }
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const buf = await readFile(join(process.cwd(), "public", file));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}
