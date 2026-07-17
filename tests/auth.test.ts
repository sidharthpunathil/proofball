import { describe, it, expect } from "vitest";
import { Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { verifyEd25519, siwsMessage } from "@/lib/auth";

describe("SIWS verifyEd25519", () => {
  const kp = Keypair.generate();
  const wallet = kp.publicKey.toBase58();
  const msg = siwsMessage(wallet, "test-nonce");
  const sig = bs58.encode(nacl.sign.detached(new TextEncoder().encode(msg), kp.secretKey));

  it("accepts a valid signature from the claimed wallet", () => {
    expect(verifyEd25519(msg, sig, wallet)).toBe(true);
  });

  it("rejects a tampered message", () => {
    expect(verifyEd25519(msg + "x", sig, wallet)).toBe(false);
  });

  it("rejects a signature checked against a different wallet", () => {
    const other = Keypair.generate().publicKey.toBase58();
    expect(verifyEd25519(msg, sig, other)).toBe(false);
  });

  it("rejects a malformed (non-base58) signature", () => {
    expect(verifyEd25519(msg, "not-base58-@@@", wallet)).toBe(false);
  });

  it("rejects a signature of the wrong length", () => {
    expect(verifyEd25519(msg, bs58.encode(new Uint8Array(10)), wallet)).toBe(false);
  });
});
