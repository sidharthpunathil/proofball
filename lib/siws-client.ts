"use client";
import bs58 from "bs58";

/**
 * Client-side Sign-In-With-Solana helper.
 *
 * Fetches a single-use nonce, signs it with the connected wallet, and returns the
 * fields to attach to a mutating request. WIRE THIS INTO THE SIGN-IN FLOW ONLY
 * when the server has AUTH_REQUIRED=true — with the flag off, the server ignores
 * these fields, so leaving the client unwired keeps the demo working today.
 *
 * Example (in store.signIn, once AUTH_REQUIRED=true):
 *   const proof = await signInWithSolana(pubkey, walletAdapter.signMessage);
 *   await fetch("/api/reward/airdrop", {
 *     method: "POST",
 *     headers: { "Content-Type": "application/json" },
 *     body: JSON.stringify(proof),
 *   });
 */
export interface SiwsProof {
  wallet: string;
  nonce: string;
  signature: string;
}

export async function signInWithSolana(
  wallet: string,
  signMessage: (msg: Uint8Array) => Promise<Uint8Array>
): Promise<SiwsProof> {
  const res = await fetch("/api/auth/nonce", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet }),
  });
  if (!res.ok) throw new Error("could not get sign-in nonce");
  const { nonce, message } = (await res.json()) as { nonce: string; message: string };
  const signature = await signMessage(new TextEncoder().encode(message));
  return { wallet, nonce, signature: bs58.encode(signature) };
}
