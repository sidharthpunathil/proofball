/**
 * Record a REAL live TxLINE match feed to fixtures/*.ndjson.
 * Run DURING a live World Cup match (the recording is your honest Demo Replay).
 *
 *   node --env-file=.env.local scripts/record.ts <fixtureId>
 *
 * Requires TXLINE_GUEST_JWT + TXLINE_API_TOKEN in env (get them from
 * `node scripts/txline-auth.ts`). Writes {t, data} lines the app replays.
 * Standalone (inlines tiny normalizers) so Node can run it directly.
 */
import { appendFileSync, mkdirSync } from "fs";
import path from "path";

const ORIGIN = process.env.TXLINE_ORIGIN ?? "https://txline-dev.txodds.com";
const API_BASE = process.env.TXLINE_API_BASE ?? `${ORIGIN}/api`;
const JWT = process.env.TXLINE_GUEST_JWT ?? "";
const API_TOKEN = process.env.TXLINE_API_TOKEN ?? "";
const FIXTURE = process.argv[2] ?? process.env.TXLINE_FIXTURE_ID ?? "";

const STATUS_PHASE: Record<number, string> = { 1: "PRE", 2: "H1", 3: "HT", 4: "H2", 5: "FT", 10: "FT", 13: "FT" };
const start = Date.now();

if (!JWT || !API_TOKEN || !FIXTURE) {
  console.error("Need TXLINE_GUEST_JWT, TXLINE_API_TOKEN and a <fixtureId>.");
  process.exit(1);
}

const outDir = path.join(process.cwd(), "fixtures");
mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `worldcup-${FIXTURE}.ndjson`);
console.log("Recording fixture", FIXTURE, "→", outFile);

function write(data: unknown) {
  appendFileSync(outFile, JSON.stringify({ t: Date.now() - start, data }) + "\n");
}

function normOdds(o: any) {
  if (!Array.isArray(o?.PriceNames) || !Array.isArray(o?.Pct)) return null;
  const iH = o.PriceNames.indexOf("part1"), iD = o.PriceNames.indexOf("draw"), iA = o.PriceNames.indexOf("part2");
  if (iH < 0 || iA < 0 || o.Pct[iH] === "NA") return null;
  return { kind: "odds", PriceNames: ["1", "X", "2"], Pct: [String(o.Pct[iH]), String(o.Pct[iD] ?? "0"), String(o.Pct[iA])], SuperOddsType: "1X2", delay: 0 };
}
function normScore(s: any) {
  const out: any[] = [];
  const phase = STATUS_PHASE[Number(s?.statusSoccerId) || 0] ?? "H2";
  const minute = Number(s?.dataSoccer?.Minutes) || 0;
  out.push({ kind: "clock", minute, phase, delay: 0 });
  const action = String(s?.action ?? "");
  if (action && action !== "comment") {
    const p1 = s?.scoreSoccer?.Participant1?.Total ?? {};
    const p2 = s?.scoreSoccer?.Participant2?.Total ?? {};
    const part = Number(s?.dataSoccer?.Participant) || 0;
    out.push({
      kind: "score", action, team: part === 1 ? "home" : part === 2 ? "away" : null,
      label: action, scoreH: Number(p1.Goals) || 0, scoreA: Number(p2.Goals) || 0,
      minute, seq: Number(s?.seq ?? s?.Seq) || 0, delay: 0,
    });
  }
  return out;
}

async function stream(pathname: string, kind: "odds" | "score") {
  const res = await fetch(`${API_BASE}/${pathname}/stream?fixtureId=${FIXTURE}`, {
    headers: { Authorization: `Bearer ${JWT}`, "X-Api-Token": API_TOKEN, Accept: "text/event-stream", "Cache-Control": "no-cache" },
  });
  if (!res.ok || !res.body) throw new Error(`${pathname} stream ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let count = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const line = block.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).replace(/^ /, "")).join("\n");
      if (!line) continue;
      let data: any;
      try { data = JSON.parse(line); } catch { continue; }
      const frames = kind === "odds" ? [normOdds(data)] : normScore(data);
      for (const f of frames) if (f) { write(f); count++; }
    }
    if (count && count % 20 === 0) console.log(`${pathname}: ${count} frames`);
  }
}

Promise.all([stream("odds", "odds"), stream("scores", "score")]).catch((e) => {
  console.error("❌", e?.message ?? e);
  process.exit(1);
});
console.log("Streaming… press Ctrl-C to stop.");
