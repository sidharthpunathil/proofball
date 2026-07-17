/**
 * One-time: create the $PROOF devnet SPL mint. The fee-payer wallet becomes the
 * mint authority (so the server can airdrop + reward).
 *
 * Run:  npm run token:create
 * Then: copy the printed NEXT_PUBLIC_PROOF_MINT line into .env
 *
 * Requires FEE_PAYER_SECRET_KEY (base58 or JSON array) with a little devnet SOL.
 */
import { Connection, Keypair } from "@solana/web3.js";
import { createMint } from "@solana/spl-token";
import bs58 from "bs58";

const RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const DECIMALS = 6;

function loadKeypair(): Keypair {
  const raw = process.env.FEE_PAYER_SECRET_KEY?.trim();
  if (!raw) throw new Error("Set FEE_PAYER_SECRET_KEY (base58 or JSON array) in .env");
  if (raw.startsWith("[")) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
  return Keypair.fromSecretKey(bs58.decode(raw));
}

async function main() {
  const payer = loadKeypair();
  const conn = new Connection(RPC, "confirmed");
  const bal = await conn.getBalance(payer.publicKey);
  console.log("fee-payer:", payer.publicKey.toBase58(), "|", (bal / 1e9).toFixed(4), "SOL");
  if (bal < 5_000_000) {
    throw new Error("fee-payer needs devnet SOL. Fund it via the faucet, then retry.");
  }

  const existing = process.env.NEXT_PUBLIC_PROOF_MINT?.trim();
  if (existing) {
    console.log("WARNING: NEXT_PUBLIC_PROOF_MINT is already set to", existing);
    console.log("Creating a NEW mint anyway. Update .env if you want to use the new one.\n");
  }

  // Mint authority = fee-payer; no freeze authority. Decimals 6.
  const mint = await createMint(conn, payer, payer.publicKey, null, DECIMALS);

  console.log("\n$PROOF mint created on devnet:");
  console.log("  ", mint.toBase58());
  console.log("\nAdd this line to .env:");
  console.log("NEXT_PUBLIC_PROOF_MINT=" + mint.toBase58());
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
