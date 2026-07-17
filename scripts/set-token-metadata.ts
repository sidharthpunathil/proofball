/**
 * Attach Metaplex Token Metadata to the $PROOF devnet mint, so wallets like
 * Phantom show the name "ProofBall", the symbol PROOF, and the logo instead of
 * a raw mint address. This is the "on-chain origin record" the whitepaper's
 * roadmap referred to as "a real face for $PROOF in your wallet".
 *
 * What it does (idempotent — safe to re-run to update name/logo):
 *   1. Uploads app/icon.png to Arweave via Irys (devnet)  -> image URI
 *   2. Uploads the token metadata JSON to Arweave          -> the on-chain `uri`
 *   3. Creates (or, if it already exists, updates) the mint's Token Metadata
 *      account, signed by the mint authority (the fee-payer wallet).
 *
 * Run:  npm run token:metadata
 * Needs: FEE_PAYER_SECRET_KEY (the mint authority) + NEXT_PUBLIC_PROOF_MINT in
 *        .env, and a little devnet SOL on the fee-payer. The 40KB icon uploads
 *        on the Irys free tier (<100KB), so no upload funding is required.
 */
import fs from "node:fs";
import path from "node:path";
import bs58 from "bs58";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import {
  createSignerFromKeypair,
  signerIdentity,
  publicKey,
  createGenericFile,
  some,
  none,
} from "@metaplex-foundation/umi";
import {
  createMetadataAccountV3,
  updateMetadataAccountV2,
  fetchMetadataFromSeeds,
  findMetadataPda,
} from "@metaplex-foundation/mpl-token-metadata";

const RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "devnet";
const ICON = "app/icon.png";

const NAME = "ProofBall";
const SYMBOL = "PROOF";
const DESCRIPTION =
  "The reward token of ProofBall, the provably-fair second screen for live football, " +
  "built on TxLINE + Solana. Devnet beta: a test token with no cash value.";

function loadSecret(): Uint8Array {
  const raw = process.env.FEE_PAYER_SECRET_KEY?.trim();
  if (!raw) throw new Error("Set FEE_PAYER_SECRET_KEY (base58 or JSON array) in .env");
  return raw.startsWith("[") ? Uint8Array.from(JSON.parse(raw)) : bs58.decode(raw);
}

async function main() {
  const mintStr = process.env.NEXT_PUBLIC_PROOF_MINT?.trim();
  if (!mintStr) throw new Error("Set NEXT_PUBLIC_PROOF_MINT in .env (run: npm run token:create)");

  const umi = createUmi(RPC).use(irysUploader({ address: "https://devnet.irys.xyz" }));
  const keypair = umi.eddsa.createKeypairFromSecretKey(loadSecret());
  const authority = createSignerFromKeypair(umi, keypair);
  umi.use(signerIdentity(authority));

  const mint = publicKey(mintStr);
  console.log("mint:        ", mintStr);
  console.log("authority:   ", authority.publicKey.toString());

  // 1) Upload the logo image.
  const bytes = fs.readFileSync(ICON);
  const file = createGenericFile(new Uint8Array(bytes), path.basename(ICON), {
    contentType: "image/png",
  });
  console.log(`uploading ${ICON} (${(bytes.length / 1024).toFixed(0)} KB) to Arweave...`);
  const [imageUri] = await umi.uploader.upload([file]);
  console.log("image URI:   ", imageUri);

  // 2) Upload the off-chain metadata JSON (this is what the on-chain `uri` points at).
  const uri = await umi.uploader.uploadJson({
    name: NAME,
    symbol: SYMBOL,
    description: DESCRIPTION,
    image: imageUri,
  });
  console.log("metadata URI:", uri);

  // 3) Create or update the on-chain Token Metadata account.
  const data = {
    name: NAME,
    symbol: SYMBOL,
    uri,
    sellerFeeBasisPoints: 0,
    creators: none(),
    collection: none(),
    uses: none(),
  };

  let exists = true;
  try {
    await fetchMetadataFromSeeds(umi, { mint });
  } catch {
    exists = false;
  }

  let signature: Uint8Array;
  if (exists) {
    console.log("metadata account exists -> updating name/symbol/uri");
    ({ signature } = await updateMetadataAccountV2(umi, {
      metadata: findMetadataPda(umi, { mint }),
      updateAuthority: authority,
      data: some(data),
    }).sendAndConfirm(umi));
  } else {
    console.log("no metadata account -> creating");
    ({ signature } = await createMetadataAccountV3(umi, {
      metadata: findMetadataPda(umi, { mint }),
      mint,
      mintAuthority: authority,
      payer: authority,
      updateAuthority: authority.publicKey,
      data,
      isMutable: true,
      collectionDetails: none(),
    }).sendAndConfirm(umi));
  }

  const sig = bs58.encode(signature);
  const metadataPda = findMetadataPda(umi, { mint })[0].toString();
  console.log("\n$PROOF now shows as \"" + NAME + "\" (" + SYMBOL + ") with a logo in any wallet.");
  console.log("metadata PDA:", metadataPda);
  console.log("tx:          ", `https://explorer.solana.com/tx/${sig}?cluster=${CLUSTER}`);
  console.log("token:       ", `https://explorer.solana.com/address/${mintStr}?cluster=${CLUSTER}`);
}

main().catch((e) => {
  console.error("ERROR:", e?.message || e);
  process.exit(1);
});
