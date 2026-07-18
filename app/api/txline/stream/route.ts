import { buildReplay } from "@/lib/demo-fixture";
import { loadRecordedFrames } from "@/lib/recorded";
import { getFixture, buildRealReplay, FEATURED_FIXTURE_ID } from "@/lib/txline-fixtures";
import { getCredentials } from "@/lib/txline-auth";
import { openLiveStream } from "@/lib/txline-live";
import { cacheGetJSON, cacheSetJSON } from "@/lib/redis";
import type { Frame } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

// A finished match's real replay is IMMUTABLE (the game is over), so once built
// it is cached in Redis and served without hitting the rate-limited devnet feed
// again. This is what makes EVERY past game reliably playable in devnet: it no
// longer degrades to a synthetic arc when the feed rolls the fixture off, rate-
// limits under load, or the creds lapse. 45 days outlives any demo; a stale
// entry self-heals on expiry.
const REPLAY_CACHE_PREFIX = "proofball:replay:v1:";
const REPLAY_TTL_SEC = 60 * 60 * 24 * 45;

// A finished match is a WATCHABLE SIMULATION, not a live broadcast. Its per-frame
// delays were tuned for event density, so the whole 90' runs by in well under a
// minute — faster than a single predict → settle cycle, so the needle whips
// around and can't really be called. We slow finished replays by a fixed factor,
// applied at PLAYBACK so it also fixes the 45-day cached replays (no cache bust),
// and floor/cap each gap so motion stays legible without long dead pauses.
// Tunable live via ?pace=N (per request) or REPLAY_PACE (global) — no code change.
// Note: too slow is also bad — if the needle barely moves in a 30s call window,
// the |delta|>0.3 settle threshold makes calls unwinnable. ~4x is the sweet spot.
const REPLAY_PACE = clampPace(Number(process.env.REPLAY_PACE ?? 4), 4);
const REPLAY_MIN_GAP_MS = Number(process.env.REPLAY_MIN_GAP_MS ?? 130);
// Cap any single gap so a dense run of events (shots, corners) never turns into a
// string of long dead pauses — snappy beats, just slower overall.
const REPLAY_MAX_GAP_MS = Number(process.env.REPLAY_MAX_GAP_MS ?? 2500);

/** Keep a pace factor sane: positive, and within a band that stays playable. */
function clampPace(n: number, fallback: number): number {
  return Number.isFinite(n) && n > 0 ? Math.min(Math.max(n, 0.5), 20) : fallback;
}

/**
 * SSE endpoint. The browser connects with a plain same-origin EventSource (no
 * headers), the TxLINE API token stays server-side. See docs/DATA.md.
 *
 * Data source, in priority order, per fixture:
 *   1. live     , real TxLINE odds+scores stream (in-running fixtures).
 *   2. real feed, the fixture's real recorded TxLINE event log + de-margined
 *                  odds (finished matches, and the pre-match final's odds).
 *   3. recorded , /fixtures/*.ndjson, if captured with `npm run record`.
 *   4. synthetic, the bundled sample arc (last resort, clearly a fallback).
 *
 * There is no user-facing "mode" switch, the app always serves the most real
 * data available and only degrades on failure, so the needle is never fake.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const fixtureId = url.searchParams.get("fixtureId") ?? FEATURED_FIXTURE_ID;
  const fixture = await getFixture(fixtureId);

  // Slow finished-match replays to a watchable, callable pace. Per-request
  // override (?pace=N) wins over the configured default; live/upcoming keep raw
  // timing, so `paced` is only ever applied on the finished path below.
  const pace = clampPace(Number(url.searchParams.get("pace")), REPLAY_PACE);
  const paced = (ms: number) =>
    ms <= 0 ? 0 : Math.min(Math.max(Math.round(ms * pace), REPLAY_MIN_GAP_MS), REPLAY_MAX_GAP_MS);

  // 1) In-running fixtures: attach the real live TxLINE stream.
  if (fixture?.status === "live") {
    const creds = await getCredentials();
    if (creds) {
      const live = await openLiveStream(creds, fixtureId);
      if (live) return live;
    }
  }

  // 2) Real recorded event log + real odds for this fixture.
  if (fixture) {
    const finished = fixture.status === "finished";
    const cacheKey = `${REPLAY_CACHE_PREFIX}${fixtureId}`;

    // 2a) Finished match: serve the durable cached replay if we have one, so a
    //     past game plays its REAL timeline without depending on the live feed.
    if (finished) {
      const cached = await cacheGetJSON<Frame[]>(cacheKey);
      if (cached && cached.length > 1) {
        return replay(req, cached.map((f) => ({ delay: paced(f.delay ?? 0), data: f })));
      }
    }

    // 2b) Build from the real feed. For a finished match, persist it so every
    //     later play (any user, any instance) is feed-independent and fast.
    const real = await buildRealReplay(fixture);
    if (real && real.length > 1) {
      if (finished) void cacheSetJSON(cacheKey, real, REPLAY_TTL_SEC);
      // Cache the RAW frames (above) so the pace stays tunable; slow only on the
      // way out, and only for a finished match. Upcoming keeps its real timing.
      return replay(req, real.map((f) => ({ delay: finished ? paced(f.delay) : f.delay, data: f })));
    }
  }

  // 3) A captured .ndjson fixture, if present.
  const recorded = loadRecordedFrames();
  if (recorded) {
    return replay(
      req,
      recorded.map((e, i) => ({
        delay: i === 0 ? 200 : Math.min(Math.max(e.t - recorded[i - 1].t, 0), 1500),
        data: e.data,
      }))
    );
  }

  // 4) Synthetic sample (last resort).
  return replay(req, buildReplay().map((f) => ({ delay: f.delay, data: f })));
}

function replay(req: Request, frames: { delay: number; data: Frame }[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: Frame) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        while (!req.signal.aborted) {
          for (const f of frames) {
            if (req.signal.aborted) break;
            await sleep(f.delay, req.signal);
            if (req.signal.aborted) break;
            send(f.data);
          }
        }
      } catch {
        /* client disconnected */
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    });
  });
}
