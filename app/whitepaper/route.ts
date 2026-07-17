import crypto from "crypto";
import { cacheGetJSON, cacheSetJSON } from "@/lib/redis";

// Serve the whitepaper PDF from the Railway bucket (S3-compatible object
// storage) at a permanent on-domain URL. The bucket is private, so each hit
// resolves to a short-lived SigV4-presigned GET and 302-redirects to it. The
// presigned URL is cached in Redis and reused across requests until it nears
// expiry, so we mint one roughly every ~55 min instead of on every visit.
// Zero SDK: the presign is ~30 lines of Node crypto.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OBJECT = "ProofBall-Whitepaper.pdf";
const CACHE_KEY = "proofball:whitepaper:url";
const URL_TTL = 3600; // presigned URL valid for 1h
const CACHE_TTL = 3300; // re-mint ~5 min before it expires, so a cached URL is always still valid

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
const hmac = (k: crypto.BinaryLike, s: string) => crypto.createHmac("sha256", k).update(s).digest();
const enc = (s: string) =>
  encodeURIComponent(s).replace(/[!*'()]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

function presign(endpoint: string, bucket: string, key: string, secret: string, region: string, expires = URL_TTL) {
  const host = `${bucket}.${new URL(endpoint).host}`;
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const uri = "/" + OBJECT.split("/").map(enc).join("/");
  const q: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${key}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expires),
    "X-Amz-SignedHeaders": "host",
  };
  const query = Object.keys(q).sort().map((k) => `${enc(k)}=${enc(q[k])}`).join("&");
  const canonical = ["GET", uri, query, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonical)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac("AWS4" + secret, dateStamp), region), "s3"), "aws4_request");
  const signature = crypto.createHmac("sha256", signingKey).update(toSign).digest("hex");
  return `https://${host}${uri}?${query}&X-Amz-Signature=${signature}`;
}

export async function GET() {
  const endpoint = process.env.WP_S3_ENDPOINT;
  const bucket = process.env.WP_S3_BUCKET;
  const key = process.env.WP_S3_KEY;
  const secret = process.env.WP_S3_SECRET;
  const region = process.env.WP_S3_REGION || "auto";
  if (!endpoint || !bucket || !key || !secret) {
    return new Response("Whitepaper storage not configured", { status: 503 });
  }

  // Reuse the Redis-cached presigned URL if it is still fresh; otherwise mint a
  // new one and cache it. Redis being down is non-fatal (cache* helpers no-op),
  // we just mint a fresh URL each time.
  let url = await cacheGetJSON<string>(CACHE_KEY);
  if (!url) {
    url = presign(endpoint, bucket, key, secret, region);
    await cacheSetJSON(CACHE_KEY, url, CACHE_TTL);
  }
  return Response.redirect(url, 302);
}
