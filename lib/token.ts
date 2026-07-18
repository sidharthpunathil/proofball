/**
 * Server-side $PROOF token helpers (devnet SPL). The fee-payer wallet
 * (FEE_PAYER_SECRET_KEY, see lib/txline-auth.ts) is the mint authority, so it
 * can mint airdrops and rewards. Every call here is a real on-chain write.
 */
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  getAssociatedTokenAddress,
  getAccount,
  mintTo,
} from "@solana/spl-token";
import { loadServerKeypair } from "./txline-auth";
import { PROOF_DECIMALS } from "./economy";

const RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "devnet";
const BASE = BigInt(10) ** BigInt(PROOF_DECIMALS);

let _conn: Connection | null = null;
export function connection(): Connection {
  if (!_conn) _conn = new Connection(RPC, "confirmed");
  return _conn;
}

export function proofMint(): PublicKey | null {
  const m = process.env.NEXT_PUBLIC_PROOF_MINT?.trim();
  if (!m) return null;
  try {
    return new PublicKey(m);
  } catch {
    return null;
  }
}

export function explorerTx(sig: string): string {
  return `https://explorer.solana.com/tx/${sig}?cluster=${CLUSTER}`;
}

/** Mint `amount` whole $PROOF (human units) to a wallet. Returns the tx signature. */
export async function mintProof(wallet: string, amount: number): Promise<string> {
  const mint = proofMint();
  if (!mint) throw new Error("NEXT_PUBLIC_PROOF_MINT not set (run: npm run token:create)");
  const payer = loadServerKeypair();
  if (!payer) throw new Error("FEE_PAYER_SECRET_KEY not set");
  const owner = new PublicKey(wallet);
  const conn = connection();
  // Create the recipient's associated token account if needed (payer covers rent).
  const ata = await getOrCreateAssociatedTokenAccount(conn, payer, mint, owner);
  const base = BigInt(Math.max(0, Math.round(amount))) * BASE;
  return mintTo(conn, payer, mint, ata.address, payer, base);
}

/** On-chain $PROOF balance for a wallet, in whole units (0 if no account yet). */
export async function proofBalance(wallet: string): Promise<number> {
  const mint = proofMint();
  if (!mint) return 0;
  try {
    const owner = new PublicKey(wallet);
    const ata = await getAssociatedTokenAddress(mint, owner);
    const acct = await getAccount(connection(), ata);
    return Number(acct.amount) / Number(BASE);
  } catch {
    return 0; // no token account = zero balance
  }
}

export function loadMintAuthority(): Keypair | null {
  return loadServerKeypair();
}

/**
 * The game treasury owner — the account that RECEIVES top-up deposits. It is the
 * fee-payer wallet (the mint authority), so deposits pile into its associated
 * token account. Cash-outs mint fresh $PROOF rather than drawing from here, so on
 * devnet the treasury simply accumulates deposits. Null if the key is unset.
 */
export function treasuryOwner(): PublicKey | null {
  const kp = loadServerKeypair();
  return kp ? kp.publicKey : null;
}
