import { buildReplay } from "@/lib/demo-fixture";
import { loadRecordedFrames } from "@/lib/recorded";
import { getFixture, buildRealReplay, FEATURED_FIXTURE_ID } from "@/lib/txline-fixtures";
import { getCredentials } from "@/lib/txline-auth";
import { openLiveStream } from "@/lib/txline-live";
import type { Frame } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

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
    const real = await buildRealReplay(fixture);
    if (real && real.length > 1) return replay(req, real.map((f) => ({ delay: f.delay, data: f })));
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
