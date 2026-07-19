import { buildReplay } from "@/lib/demo-fixture";
import { loadRecordedFrames } from "@/lib/recorded";
import {
  getFixture,
  buildRealReplay,
  buildSmoothReplay,
  REPLAY_MS_PER_MIN,
  FEATURED_FIXTURE_ID,
} from "@/lib/txline-fixtures";
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

// A finished match is a WATCHABLE SIMULATION, not a live broadcast. Its real
// /scores/snapshot log is SPARSE — most rows carry no clock and the few real
// events cluster late — so played raw the clock lurches (0' → 84') and the
// needle whips around uncallably. `buildSmoothReplay` reconstructs a continuous
// minute-by-minute timeline from the real events + running score; this happens
// at PLAYBACK, so it also fixes the 45-day cached replays with no cache bust.
//
// Playback speed is user-facing: ?speed=N (1 = real time, a 90' match takes 90
// min; 2/5/10/20 fast-forward). It DIVIDES each gap. We floor/cap each gap so a
// dense burst never stalls and a high speed still animates rather than teleports.
// The cap must never fall below one real-time match-minute, or 1× (a 60,000ms
// per-minute gap) would be crushed and stop being real time , so it tracks
// REPLAY_MS_PER_MIN.
const SMOOTH_MIN_GAP_MS = Number(process.env.REPLAY_MIN_GAP_MS ?? 40);
const REPLAY_MAX_GAP_MS = Math.max(
  Number(process.env.REPLAY_MAX_GAP_MS ?? 0),
  REPLAY_MS_PER_MIN,
);

/** Clamp the playback multiplier to a sane, playable band (1×–100×; default 1×). */
function clampSpeed(n: number): number {
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 100) : 1;
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

  // Playback speed for finished replays: ?speed=N (1 = watchable, 2/5/10 = fast
  // forward). Divides each reconstructed gap; live/upcoming keep their own timing.
  const speed = clampSpeed(Number(url.searchParams.get("speed")));
  const speedGap = (ms: number) =>
    ms <= 0 ? 0 : Math.min(Math.max(Math.round(ms / speed), SMOOTH_MIN_GAP_MS), REPLAY_MAX_GAP_MS);

  // Resume point. Changing speed reconnects the stream; ?from=<minute already on
  // screen> makes the replay seek past that minute and pick up where it left off
  // (so a speed change keeps the current time + win-probability instead of
  // snapping back to kick-off). 0/absent = play from the start. Finished only.
  const from = Math.max(0, Math.floor(Number(url.searchParams.get("from")) || 0));

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
    const cacheKey = `${REPLAY_CACHE_PREFIX}${fixtureId}`;

    if (fixture.status === "finished") {
      // Serve the durable cached RAW frames if present, else build + persist
      // them. Either way the smooth minute-by-minute timeline is reconstructed
      // at PLAYBACK (so cached replays are fixed too), then paced by ?speed=.
      let rawFrames = await cacheGetJSON<Frame[]>(cacheKey);
      if (!rawFrames || rawFrames.length <= 1) {
        const built = await buildRealReplay(fixture);
        if (built && built.length > 1) {
          void cacheSetJSON(cacheKey, built, REPLAY_TTL_SEC);
          rawFrames = built;
        }
      }
      if (rawFrames && rawFrames.length > 1) {
        const smooth = buildSmoothReplay(rawFrames);
        const paced = smooth.map((f) => ({ delay: speedGap(f.delay ?? 0), data: f }));
        // Seek past the minute already on screen (see ?from=): skip up to the
        // first clock AFTER `from`. The client keeps its state for the earlier
        // minutes, and buildSmoothReplay is deterministic so they match exactly.
        // Past the end (from ≥ final minute) resumes at the last frame.
        let skipFirst = 0;
        if (from > 0) {
          const i = paced.findIndex((f) => f.data.kind === "clock" && f.data.minute > from);
          skipFirst = i >= 0 ? i : paced.length - 1;
          // A fresh deep-link (?from= on first load) has no earlier client state,
          // and the real log is sparse: the next score event can be many minutes
          // away, leaving the score at 0-0 mid-match. Re-seed the running score
          // by forwarding the last score frame before the seek point. (On a
          // speed-change resume this is an idempotent re-ingest.)
          const seed = paced
            .slice(0, skipFirst)
            .reverse()
            .find((f) => f.data.kind === "score");
          if (seed) {
            // Zero the first post-seek gap too: seeking already "spent" that
            // wait, and keeping it would stall the clock a full pacing gap
            // behind the baseline no-seed timing.
            const rest = paced.slice(skipFirst);
            if (rest.length > 0) rest[0] = { ...rest[0], delay: 0 };
            return replay(req, [{ delay: 0, data: seed.data }, ...rest]);
          }
        }
        return replay(req, paced, skipFirst);
      }
    } else {
      // Upcoming: the real feed with its own timing — no smoothing, no pacing.
      const real = await buildRealReplay(fixture);
      if (real && real.length > 1) {
        return replay(req, real.map((f) => ({ delay: f.delay, data: f })));
      }
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

function replay(
  req: Request,
  frames: { delay: number; data: Frame }[],
  skipFirst = 0,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: Frame) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        // On the FIRST pass, skip the frames before the resume point and paint
        // the resumed state instantly; then honour the paced gaps. Every later
        // loop replays the whole match from the top.
        let first = true;
        while (!req.signal.aborted) {
          const start = first ? skipFirst : 0;
          for (let i = start; i < frames.length; i++) {
            if (req.signal.aborted) break;
            const wait = first && i === start && skipFirst > 0 ? 0 : frames[i].delay;
            await sleep(wait, req.signal);
            if (req.signal.aborted) break;
            send(frames[i].data);
          }
          first = false;
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
