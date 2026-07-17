/**
 * Sign-In-With-Solana (SIWS) — server-side wallet-ownership proof.
 *
 * Closes the root cause behind the top audit findings (unauthenticated airdrop
 * mint / Sybil, leaderboard spoofing): mutating routes can require a signature
 * proving the caller controls the wallet, instead of trusting a wallet string in
 * the request body.
 *
 * Enforcement is GATED by the AUTH_REQUIRED env flag:
 *   • AUTH_REQUIRED !== "true" (default): routes keep their current behavior so
 *     the devnet demo runs friction-free. `resolveWallet` trusts body.wallet.
 *   • AUTH_REQUIRED === "true": routes require { wallet, nonce, signature };
 *     the single-use nonce is consumed and the ed25519 signature is verified.
 *     Fails CLOSED (deny) on any missing/invalid input or Redis outage.
 *
 * Production should set AUTH_REQUIRED=true AND wire the client to sign the nonce
 * (see lib/siws-client.ts). Until then, keep it off. See docs/SECURITY-AUDIT.md.
 */
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { getRedis } from "./redis";

const NONCE_PREFIX = "proofball:siws:nonce:";
const NONCE_TTL_SEC = 300; // 5 min to sign

/** Whether wallet-signature enforcement is on. Exact "true" only (never fail open by typo). */
export function authRequired(): boolean {
  return process.env.AUTH_REQUIRED === "true";
}

/** The exact message a wallet signs. MUST stay in sync with lib/siws-client.ts. */
export function siwsMessage(wallet: string, nonce: string): string {
  return `ProofBall sign-in\nwallet: ${wallet}\nnonce: ${nonce}`;
}

/** Issue a single-use nonce bound to `wallet` (Redis, short TTL). Null if no store. */
export async function issueNonce(wallet: string): Promise<string | null> {
  const r = getRedis();
  if (!r) return null;
  const nonce = bs58.encode(nacl.randomBytes(24)); // 192-bit CSPRNG nonce
  try {
    await r.set(NONCE_PREFIX + nonce, wallet, "EX", NONCE_TTL_SEC);
    return nonce;
  } catch {
    return null;
  }
}

/** Pure ed25519 check: did `wallet` produce `signatureB58` over `message`? */
export function verifyEd25519(message: string, signatureB58: string, wallet: string): boolean {
  try {
    const pub = new PublicKey(wallet).toBytes();
    const sig = bs58.decode(signatureB58);
    if (sig.length !== 64) return false;
    return nacl.sign.detached.verify(new TextEncoder().encode(message), sig, pub);
  } catch {
    return false;
  }
}

export interface VerifyResult {
  ok: boolean;
  wallet: string;
  error?: string;
}

/**
 * Resolve the caller's wallet for a mutating route.
 *  - AUTH_REQUIRED off: returns body.wallet as-is (legacy demo behavior).
 *  - AUTH_REQUIRED on: requires { wallet, nonce, signature }; atomically consumes
 *    the single-use nonce (must have been issued for this wallet) and verifies the
 *    ed25519 signature. Fails closed on any problem.
 */
export async function resolveWallet(body: Record<string, unknown>): Promise<VerifyResult> {
  const wallet = String(body.wallet ?? "").trim();
  if (!authRequired()) return { ok: true, wallet };

  const nonce = String(body.nonce ?? "").trim();
  const signature = String(body.signature ?? "").trim();
  if (!wallet || !nonce || !signature) {
    return { ok: false, wallet, error: "signature required" };
  }
  const r = getRedis();
  if (!r) return { ok: false, wallet, error: "auth unavailable" }; // fail closed

  // Single-use: atomically read + delete the nonce so it can never be replayed.
  let owner: string | null;
  try {
    const GETDEL = `local v = redis.call('GET', KEYS[1])
if v then redis.call('DEL', KEYS[1]) end
return v`;
    owner = (await r.eval(GETDEL, 1, NONCE_PREFIX + nonce)) as string | null;
  } catch {
    return { ok: false, wallet, error: "auth unavailable" };
  }
  if (!owner || owner !== wallet) {
    return { ok: false, wallet, error: "invalid or expired nonce" };
  }
  if (!verifyEd25519(siwsMessage(wallet, nonce), signature, wallet)) {
    return { ok: false, wallet, error: "invalid signature" };
  }
  return { ok: true, wallet };
}
