import nacl from "tweetnacl";
import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";

/**
 * Server-side TxLINE credentials.
 *
 * The World Cup feed is an app-level entitlement, so ONE server wallet holds
 * the subscription and streams data to every user (their personal Solana
 * identity comes from the wallet they connect and is used for prediction
 * commitments).
 *
 * Flow:
 *   1. Subscribe on-chain ONCE with the server wallet, run `npm run txline:auth`
 *      (script prints the txSig → set TXLINE_SUBSCRIBE_TXSIG).
 *   2. On demand, re-activate: fresh guest JWT + a detached ed25519 signature
 *      over `${txSig}:${leagues}:${jwt}` → API token. Cached with a short TTL.
 *
 * No Anchor here (kept out of the web bundle); only nacl + fetch.
 */

export interface Creds {
  jwt: string;
  apiToken: string;
}

const ORIGIN = process.env.TXLINE_API_BASE?.replace(/\/api\/?$/, "") ?? "https://txline-dev.txodds.com";
const API_BASE = process.env.TXLINE_API_BASE ?? "https://txline-dev.txodds.com/api";
const TX_SIG = process.env.TXLINE_SUBSCRIBE_TXSIG ?? "";

let cache: { creds: Creds; at: number } | null = null;
const TTL_MS = 20 * 60 * 1000; // re-activate every 20 min

export function loadServerKeypair(): Keypair | null {
  const raw = process.env.FEE_PAYER_SECRET_KEY?.trim();
  if (!raw) return null;
  try {
    if (raw.startsWith("[")) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
    return Keypair.fromSecretKey(bs58.decode(raw));
  } catch {
    return null;
  }
}

export async function getGuestJwt(): Promise<string> {
  const res = await fetch(`${ORIGIN}/auth/guest/start`, { method: "POST" });
  if (!res.ok) throw new Error(`guest/start ${res.status}`);
  const data = await res.json();
  return data.token as string;
}

/** Re-activate an existing on-chain subscription (txSig) → API token. */
export async function activateWithTxSig(
  txSig: string,
  keypair: Keypair,
  leagues: number[] = []
): Promise<Creds> {
  const jwt = await getGuestJwt();
  const messageString = `${txSig}:${leagues.join(",")}:${jwt}`;
  const sig = nacl.sign.detached(new TextEncoder().encode(messageString), keypair.secretKey);
  const walletSignature = Buffer.from(sig).toString("base64");

  const res = await fetch(`${API_BASE}/token/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ txSig, walletSignature, leagues }),
  });
  if (!res.ok) throw new Error(`activate ${res.status}: ${await res.text().catch(() => "")}`);
  // Activation replies with the token as PLAIN TEXT (some deployments send {token}).
  const raw = await res.text();
  let apiToken: string | null = null;
  try {
    const j = JSON.parse(raw);
    apiToken = j && typeof j === "object" ? (j.token ?? null) : j;
  } catch {
    apiToken = raw.trim() || null;
  }
  if (!apiToken) throw new Error("activate: no token in response");
  return { jwt, apiToken };
}

/**
 * Cached credentials for live streaming. The API token is long-lived (minted
 * once by the subscribe+activate script); only the guest JWT is refreshed here.
 * Returns null if TXLINE_API_TOKEN isn't configured (caller falls back to replay).
 */
export async function getCredentials(force = false): Promise<Creds | null> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.creds;
  const apiToken = process.env.TXLINE_API_TOKEN?.trim();
  if (!apiToken) return null;
  try {
    const jwt = await getGuestJwt(); // refresh the short-lived JWT; reuse the stored token
    cache = { creds: { jwt, apiToken }, at: Date.now() };
    return cache.creds;
  } catch {
    return null;
  }
}

export const TXLINE = { ORIGIN, API_BASE, TX_SIG };
