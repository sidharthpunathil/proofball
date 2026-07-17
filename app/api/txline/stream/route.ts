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
        return replay(req, cached.map((f) => ({ delay: f.delay ?? 0, data: f })));
      }
    }

    // 2b) Build from the real feed. For a finished match, persist it so every
    //     later play (any user, any instance) is feed-independent and fast.
    const real = await buildRealReplay(fixture);
    if (real && real.length > 1) {
      if (finished) void cacheSetJSON(cacheKey, real, REPLAY_TTL_SEC);
      return replay(req, real.map((f) => ({ delay: f.delay, data: f })));
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
