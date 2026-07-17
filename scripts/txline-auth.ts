/**
 * One-time TxLINE devnet subscribe + activate with the SERVER wallet.
 * Run once, then paste the printed values into your env.
 *
 *   node --env-file=.env.local scripts/txline-auth.ts
 *
 * Requires: FEE_PAYER_SECRET_KEY (base58 or JSON array) funded with devnet SOL.
 * Mirrors https://txline-docs.txodds.com/documentation/quickstart exactly.
 */
import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { readFileSync } from "fs";
import path from "path";

const ORIGIN = process.env.TXLINE_ORIGIN ?? "https://txline-dev.txodds.com";
const API_BASE = `${ORIGIN}/api`;
const RPC = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const MINT = new PublicKey(process.env.TXL_MINT ?? "4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG");
const SERVICE_LEVEL_ID = 1;
const DURATION_WEEKS = 4;
const LEAGUES: number[] = [];

function loadKeypair(): Keypair {
  const raw = process.env.FEE_PAYER_SECRET_KEY?.trim();
  if (!raw) throw new Error("Set FEE_PAYER_SECRET_KEY (base58 or JSON array) in your env.");
  if (raw.startsWith("[")) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
  return Keypair.fromSecretKey(bs58.decode(raw));
}

async function main() {
  const kp = loadKeypair();
  const connection = new Connection(RPC, "confirmed");
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(kp), {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const idl = JSON.parse(
    readFileSync(path.join(process.cwd(), "lib/idl/txoracle.json"), "utf8")
  );
  const program = new anchor.Program(idl, provider);

  const bal = await connection.getBalance(kp.publicKey);
  console.log("Wallet:", kp.publicKey.toBase58(), "| SOL:", (bal / 1e9).toFixed(4));
  if (bal < 3_000_000) {
    console.log("Low balance, requesting airdrop…");
    try {
      const sig = await connection.requestAirdrop(kp.publicKey, 1_000_000_000);
      await connection.confirmTransaction(sig, "confirmed");
    } catch {
      console.log("Airdrop failed (rate limit). Fund the wallet from faucet.solana.com and retry.");
    }
  }

  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_treasury_v2")],
    program.programId
  );
  const tokenTreasuryVault = getAssociatedTokenAddressSync(
    MINT,
    tokenTreasuryPda,
    true,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pricing_matrix")],
    program.programId
  );
  const userTokenAccount = getAssociatedTokenAddressSync(
    MINT,
    kp.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  console.log("Subscribing (service level 1, 4 weeks, free World Cup tier)…");
  const txSig = await program.methods
    .subscribe(SERVICE_LEVEL_ID, DURATION_WEEKS)
    .preInstructions([
      // ensure the user's TOKEN-2022 ATA exists (source account for the 0-TxL transfer)
      createAssociatedTokenAccountIdempotentInstruction(
        kp.publicKey,
        userTokenAccount,
        kp.publicKey,
        MINT,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
    ])
    .accounts({
      user: kp.publicKey,
      pricingMatrix: pricingMatrixPda,
      tokenMint: MINT,
      userTokenAccount,
      tokenTreasuryVault,
      tokenTreasuryPda,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  await connection.confirmTransaction(txSig, "confirmed");
  console.log("subscribe txSig:", txSig);

  const jwt = (await (await fetch(`${ORIGIN}/auth/guest/start`, { method: "POST" })).json()).token;
  const message = new TextEncoder().encode(`${txSig}:${LEAGUES.join(",")}:${jwt}`);
  const walletSignature = Buffer.from(nacl.sign.detached(message, kp.secretKey)).toString("base64");

  const actRes = await fetch(`${API_BASE}/token/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ txSig, walletSignature, leagues: LEAGUES }),
  });
  if (!actRes.ok) throw new Error(`activate ${actRes.status}: ${await actRes.text()}`);
  // Activation replies with the token as PLAIN TEXT (some deployments send {token}).
  const rawAct = await actRes.text();
  let apiToken: string | null = null;
  try {
    const j = JSON.parse(rawAct);
    apiToken = j && typeof j === "object" ? (j.token ?? null) : j;
  } catch {
    apiToken = rawAct.trim() || null;
  }
  if (!apiToken) throw new Error(`activate returned no token: ${rawAct.slice(0, 120)}`);

  console.log("\n✅ Activated. Add these to .env.local / Vercel:\n");
  console.log(`TXLINE_SUBSCRIBE_TXSIG=${txSig}`);
  console.log(`TXLINE_API_TOKEN=${apiToken}`);
  console.log(`TXLINE_GUEST_JWT=${jwt}`);
  console.log(`\nExplorer: https://explorer.solana.com/tx/${txSig}?cluster=devnet`);
}

main().catch((e) => {
  console.error("❌", e?.message ?? e);
  process.exit(1);
});
