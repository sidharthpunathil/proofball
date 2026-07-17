/**
 * Pre-warm the durable replay cache for every finished match, so ALL past games
 * are playable in devnet without ever hitting the rate-limited TxLINE feed at
 * click-time (see the cache in app/api/txline/stream/route.ts).
 *
 *   docker compose up -d                 # Postgres + Redis
 *   NEXT_DIST_DIR=.next-run PORT=3200 npm run dev   # a running app instance
 *   npm run matches:warm                 # warms that instance's Redis
 *
 * How it works: hitting the SSE stream once makes the server build the real
 * replay and write it to Redis (that write happens as the route runs, before we
 * read many frames), so a brief connection per fixture is enough. The fixture
 * ids come from Postgres (`matches`); the app whose Redis gets warmed is chosen
 * by WARM_BASE_URL. To warm production, point WARM_BASE_URL at the live app:
 *
 *   WARM_BASE_URL=https://proofball-production.up.railway.app npm run matches:warm
 *
 * Idempotent and safe to re-run; finished results are immutable.
 */
import pg from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://proofball:proofball@localhost:55432/proofball";
const BASE = (process.env.WARM_BASE_URL || "http://localhost:3200").replace(/\/$/, "");
// How long to hold each stream open. The cache write happens server-side almost
// immediately; a couple of seconds is ample headroom for a cold feed fetch.
const HOLD_MS = Number(process.env.WARM_HOLD_MS || 4000);

async function warmOne(id) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), HOLD_MS);
  try {
    const res = await fetch(`${BASE}/api/txline/stream?fixtureId=${id}`, {
      signal: ctrl.signal,
      headers: { Accept: "text/event-stream" },
    });
    if (!res.ok || !res.body) return { id, ok: false, reason: `HTTP ${res.status}` };
    // Read a little of the stream to be sure the handler ran (and cached).
    const reader = res.body.getReader();
    let frames = 0;
    const decoder = new TextDecoder();
    let buf = "";
    while (frames < 6) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      frames += (buf.match(/\n\ndata:|^data:/g) || []).length;
    }
    return { id, ok: true, frames };
  } catch (e) {
    // Abort after HOLD_MS is the normal, successful path.
    if (e?.name === "AbortError") return { id, ok: true, aborted: true };
    return { id, ok: false, reason: e?.message || "error" };
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 4, connectionTimeoutMillis: 5000 });
  const { rows } = await pool.query(
    "SELECT fixture_id, home_name, away_name FROM matches WHERE finished = TRUE ORDER BY round_rank DESC, start_time DESC"
  );
  await pool.end();
  console.log(`→ warming ${rows.length} finished-match replays via ${BASE} …`);

  let ok = 0;
  // Sequential: the feed is rate-limited, so we don't want a 30-way burst.
  for (const r of rows) {
    const out = await warmOne(r.fixture_id);
    ok += out.ok ? 1 : 0;
    const tag = out.ok ? "✓" : "✗";
    console.log(`  ${tag} ${r.fixture_id}  ${r.home_name} v ${r.away_name}${out.reason ? `  (${out.reason})` : ""}`);
  }
  console.log(`✓ warmed ${ok}/${rows.length} replays into the cache.`);
  if (ok < rows.length) process.exit(1);
}

main().catch((e) => {
  console.error("warm failed:", e.message);
  process.exit(1);
});
