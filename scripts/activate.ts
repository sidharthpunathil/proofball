/**
 * Re-activate the existing on-chain subscription (no re-subscribe) and list
 * World Cup fixtures so you can pick a TXLINE_FIXTURE_ID.
 *   node --env-file=.env scripts/activate.ts
 */
import { Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { writeFileSync } from "fs";

const ORIGIN = process.env.TXLINE_ORIGIN ?? "https://txline-dev.txodds.com";
const API_BASE = process.env.TXLINE_API_BASE ?? `${ORIGIN}/api`;
const TX_SIG = process.env.TXLINE_SUBSCRIBE_TXSIG ?? "";
const COMP = process.env.WORLDCUP_COMPETITION_ID ?? "72";

function loadKeypair(): Keypair {
  const raw = process.env.FEE_PAYER_SECRET_KEY?.trim();
  if (!raw) throw new Error("FEE_PAYER_SECRET_KEY missing");
  return raw.startsWith("[")
    ? Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)))
    : Keypair.fromSecretKey(bs58.decode(raw));
}

async function main() {
  if (!TX_SIG) throw new Error("TXLINE_SUBSCRIBE_TXSIG missing");
  const kp = loadKeypair();

  const jwt = (await (await fetch(`${ORIGIN}/auth/guest/start`, { method: "POST" })).json()).token;
  const message = new TextEncoder().encode(`${TX_SIG}::${jwt}`);
  const walletSignature = Buffer.from(nacl.sign.detached(message, kp.secretKey)).toString("base64");

  const res = await fetch(`${API_BASE}/token/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ txSig: TX_SIG, walletSignature, leagues: [] }),
  });
  const raw = await res.text();
  console.log("activate status:", res.status);
  console.log("activate raw body:", raw.slice(0, 200));

  let apiToken: string | null = null;
  try {
    const j = JSON.parse(raw);
    apiToken = j && typeof j === "object" ? (j.token ?? null) : j;
  } catch {
    apiToken = raw.trim() || null;
  }
  console.log("→ apiToken:", apiToken ? `${apiToken.slice(0, 12)}…` : null);
  if (!apiToken) process.exit(1);

  const H = { Authorization: `Bearer ${jwt}`, "X-Api-Token": apiToken };
  const fx = await fetch(`${API_BASE}/fixtures/snapshot?competitionId=${COMP}`, { headers: H });
  console.log("fixtures status:", fx.status);
  const list = await fx.json().catch(() => null);
  if (Array.isArray(list)) {
    console.log(`fixtures: ${list.length}`);
    for (const f of list.slice(0, 12)) {
      console.log(`  ${f.FixtureId}  ${f.Participant1} v ${f.Participant2}  @ ${new Date(f.StartTime).toISOString()}`);
    }
  } else {
    console.log("fixtures body:", JSON.stringify(list).slice(0, 200));
  }

  // Don't print full secrets to stdout; write them to a 0600 gitignored file.
  const mask = (s: string) => (s.length <= 10 ? "***" : `${s.slice(0, 6)}…${s.slice(-4)}`);
  const outFile = ".env.txline.local";
  writeFileSync(outFile, `TXLINE_API_TOKEN=${apiToken}\nTXLINE_GUEST_JWT=${jwt}\n`, { mode: 0o600 });
  console.log(`\n# saved to ${outFile} (gitignored, chmod 600). Preview:`);
  console.log(`TXLINE_API_TOKEN=${mask(apiToken)}`);
  console.log(`TXLINE_GUEST_JWT=${mask(jwt)}`);
}

main().catch((e) => {
  console.error("❌", e?.message ?? e);
  process.exit(1);
});
