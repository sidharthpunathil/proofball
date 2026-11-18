import { getAssetsBucket } from "@/lib/d1";

// Serve the whitepaper PDF from the R2 bucket at a permanent on-domain URL.
// The Worker reads the object through its R2 binding and streams it back, so
// there are no presigned URLs or bucket credentials to manage. If R2 is
// unavailable it falls back to the copy bundled in /public.
export const dynamic = "force-dynamic";

const OBJECT = "ProofBall-Whitepaper.pdf";

export async function GET(req: Request) {
  const bucket = getAssetsBucket();
  const obj = bucket ? await bucket.get(OBJECT).catch(() => null) : null;
  if (!obj) {
    return Response.redirect(new URL(`/${OBJECT}`, req.url), 302);
  }
  const headers = new Headers();
  headers.set("content-type", "application/pdf");
  headers.set("content-disposition", `inline; filename="${OBJECT}"`);
  headers.set("cache-control", "public, max-age=3600");
  headers.set("etag", obj.httpEtag);
  // Workers' ReadableStream type differs from the DOM lib's; they're the same at runtime.
  return new Response(obj.body as unknown as ReadableStream, { headers });
}
