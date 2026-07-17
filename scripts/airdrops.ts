/**
 * Print the welcome-airdrop ledger: every wallet that received (or was checked
 * for) the one-time $PROOF airdrop, with amount, position, mint tx, and time.
 *
 * Run:  npm run airdrops
 *
 * Reads the same Redis HASH the /api/reward/airdrop route writes
 * (proofball:airdrops). Point REDIS_URL at prod to inspect the live ledger.
 */
import Redis from "ioredis";

const LEDGER_KEY = "proofball:airdrops";
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:63799";

interface AirdropRecord {
  wallet: string;
  amount: number;
  position: number | null;
  ts: number;
  signature: string | null;
  status: string;
  balance?: number;
}

async function main() {
  // Offline queue ON (the default): this is a one-shot CLI, so let the first
  // command wait for the connection rather than racing it (as the app does).
  const r = new Redis(REDIS_URL, { maxRetriesPerRequest: 2, connectTimeout: 4000 });
  const all = await r.hgetall(LEDGER_KEY);
  const recs: AirdropRecord[] = Object.values(all)
    .map((v) => {
      try {
        return JSON.parse(v) as AirdropRecord;
      } catch {
        return null;
      }
    })
    .filter((x): x is AirdropRecord => x !== null)
    .sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));

  if (recs.length === 0) {
    console.log("No airdrop records yet.");
  } else {
    const minted = recs.filter((x) => x.status === "airdropped" || x.status === "landed-late");
    const total = minted.reduce((s, x) => s + (x.amount || 0), 0);
    console.log(
      `\n$PROOF welcome airdrops — ${recs.length} wallets, ${minted.length} minted, ${total} $PROOF total\n`,
    );
    for (const x of recs) {
      const when = x.ts ? new Date(x.ts).toISOString() : "—";
      // Flag anomalies: an on-chain balance above the airdrop amount means this
      // wallet was funded more than once (a pre-fix double-airdrop).
      const bal = typeof x.balance === "number" ? x.balance : null;
      const flag = bal !== null && bal > (x.amount ?? 0) ? `  ⚠ holds ${bal}` : "";
      console.log(
        `${(x.wallet ?? "").padEnd(46)}  ${String(x.amount ?? 0).padStart(5)} $PROOF  ` +
          `#${x.position ?? "?"}  ${(x.status ?? "").padEnd(14)}  ${when}  ${x.signature ?? ""}${flag}`,
      );
    }
    const anomalies = recs.filter((x) => typeof x.balance === "number" && x.balance! > (x.amount ?? 0));
    if (anomalies.length) {
      console.log(`\n⚠ ${anomalies.length} wallet(s) hold more than one airdrop (pre-fix double-mint).`);
    }
    console.log("");
  }
  await r.quit();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
