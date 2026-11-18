/**
 * Print the welcome-airdrop ledger: every wallet that received (or was checked
 * for) the one-time $PROOF airdrop, with amount, position, mint tx, and time.
 *
 * Run:  npm run airdrops
 *
 * Reads the same D1 table the /api/reward/airdrop route writes (`airdrops`),
 * from the remote database by default (D1_LOCAL=1 for the local one).
 */
import { d1Query } from "./d1.mjs";

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
  const rows = d1Query("SELECT record FROM airdrops") as { record: string }[];
  const recs: AirdropRecord[] = rows
    .map(({ record: v }) => {
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
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
