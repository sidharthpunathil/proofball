import type { Frame, OddsFrame, ScoreFrame, ClockFrame, Phase } from "./types";
import type { Creds } from "./txline-auth";

/**
 * Normalize the real TxLINE odds + scores SSE streams into our `Frame` shape
 * and merge them into one same-origin stream for the browser. Best-effort
 * mapping per the documented OddsPayload / Scores schemas (ProofBall.md §4);
 * tune the score mapping against real recorded data.
 */

const STATUS_PHASE: Record<number, Phase> = {
  1: "PRE",
  2: "H1",
  3: "HT",
  4: "H2",
  5: "FT",
  7: "H2",
  9: "H2",
  10: "FT",
  13: "FT",
};

function num(v: unknown, d = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

/**
 * OddsPayload → OddsFrame. Only the 1X2 result market drives the needle.
 * Real TxLINE shape: SuperOddsType "1X2_PARTICIPANT_RESULT",
 * PriceNames ["part1","draw","part2"] → mapped to ["1","X","2"].
 */
export function normalizeOdds(o: Record<string, unknown>): OddsFrame | null {
  const names = o.PriceNames as string[] | undefined;
  const pct = o.Pct as string[] | undefined;
  if (!Array.isArray(names) || !Array.isArray(pct)) return null;
  const type = String(o.SuperOddsType ?? "");
  const iHome = names.indexOf("part1");
  const iDraw = names.indexOf("draw");
  const iAway = names.indexOf("part2");
  const isMoneyline = type.includes("1X2") || (iHome >= 0 && iDraw >= 0 && iAway >= 0);
  if (!isMoneyline || iHome < 0 || iAway < 0) return null;
  if (pct[iHome] === "NA") return null;
  return {
    kind: "odds",
    PriceNames: ["1", "X", "2"],
    Pct: [String(pct[iHome]), String(pct[iDraw] ?? "0"), String(pct[iAway])],
    SuperOddsType: "1X2",
    delay: 0,
  };
}

/** Scores record → [clock, score?] frames. */
export function normalizeScore(s: Record<string, unknown>): Frame[] {
  const out: Frame[] = [];
  const statusId = num(s.statusSoccerId, 0);
  const dataSoccer = (s.dataSoccer ?? {}) as Record<string, unknown>;
  const minute = num(dataSoccer.Minutes, NaN);
  const phase = STATUS_PHASE[statusId] ?? "H2";

  const clock: ClockFrame = {
    kind: "clock",
    minute: Number.isFinite(minute) ? minute : 0,
    phase,
    delay: 0,
  };
  out.push(clock);

  const action = String(s.action ?? "");
  if (action && action !== "comment") {
    const score = (s.scoreSoccer ?? {}) as Record<string, unknown>;
    const p1 = ((score.Participant1 as Record<string, unknown>)?.Total ?? {}) as Record<string, unknown>;
    const p2 = ((score.Participant2 as Record<string, unknown>)?.Total ?? {}) as Record<string, unknown>;
    const participant = num(dataSoccer.Participant, 0);
    const team = participant === 1 ? "home" : participant === 2 ? "away" : null;
    const score2: ScoreFrame = {
      kind: "score",
      action,
      team,
      label: labelFor(action, team),
      scoreH: num(p1.Goals, 0),
      scoreA: num(p2.Goals, 0),
      minute: clock.minute,
      seq: num(s.seq ?? s.Seq, 0),
      delay: 0,
    };
    out.push(score2);
  }
  return out;
}

function labelFor(action: string, team: "home" | "away" | null): string {
  const side = team === "home" ? "Home" : team === "away" ? "Away" : "";
  switch (action) {
    case "goal":
      return `⚽ GOAL, ${side}`;
    case "red_card":
      return `🟥 Red card, ${side}`;
    case "yellow_card":
      return `🟨 Yellow, ${side}`;
    case "corner":
      return `Corner ${side}`;
    case "shot":
      return `Shot ${side}`;
    case "game_finalised":
      return "Full-time";
    default:
      return `${action} ${side}`.trim();
  }
}

function parseSseBlock(block: string): Record<string, unknown> | null {
  const dataLines = block
    .split("\n")
    .filter((l) => l.startsWith("data:"))
    .map((l) => l.slice(5).replace(/^ /, ""));
  if (dataLines.length === 0) return null;
  try {
    return JSON.parse(dataLines.join("\n"));
  } catch {
    return null;
  }
}

/** Open + merge the real TxLINE odds/scores streams. Returns null on failure. */
export async function openLiveStream(creds: Creds, fixtureId?: string): Promise<Response | null> {
  const headers = {
    Authorization: `Bearer ${creds.jwt}`,
    "X-Api-Token": creds.apiToken,
    Accept: "text/event-stream",
    "Cache-Control": "no-cache",
  };
  const q = fixtureId ? `?fixtureId=${fixtureId}` : "";
  const base = process.env.TXLINE_API_BASE ?? "https://txline-dev.txodds.com/api";

  let oddsRes: Response, scoresRes: Response;
  try {
    [oddsRes, scoresRes] = await Promise.all([
      fetch(`${base}/odds/stream${q}`, { headers }),
      fetch(`${base}/scores/stream${q}`, { headers }),
    ]);
  } catch {
    return null;
  }
  if (!oddsRes.ok || !oddsRes.body) return null;

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const pump = async (res: Response, kind: "odds" | "score") => {
        if (!res.body) return;
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i: number;
          while ((i = buf.indexOf("\n\n")) >= 0) {
            const block = buf.slice(0, i);
            buf = buf.slice(i + 2);
            const data = parseSseBlock(block);
            if (!data) continue;
            const frames = kind === "odds" ? [normalizeOdds(data)] : normalizeScore(data);
            for (const f of frames) if (f) controller.enqueue(enc.encode(`data: ${JSON.stringify(f)}\n\n`));
          }
        }
      };
      // Seed from snapshots so the needle shows real probability immediately
      // (even pre-match / before the first stream tick).
      const seed = async () => {
        if (!fixtureId) return;
        try {
          const s = await fetch(`${base}/odds/snapshot/${fixtureId}`, { headers });
          if (s.ok) {
            const rows = await s.json();
            if (Array.isArray(rows)) {
              for (const r of rows) {
                const f = normalizeOdds(r);
                if (f) {
                  controller.enqueue(enc.encode(`data: ${JSON.stringify(f)}\n\n`));
                  break;
                }
              }
            }
          }
          const sc = await fetch(`${base}/scores/snapshot/${fixtureId}`, { headers });
          if (sc.ok) {
            const rows = await sc.json();
            if (Array.isArray(rows) && rows.length) {
              for (const f of normalizeScore(rows[rows.length - 1]))
                controller.enqueue(enc.encode(`data: ${JSON.stringify(f)}\n\n`));
            }
          }
        } catch {
          /* ignore seed errors */
        }
      };

      seed().finally(() =>
        Promise.all([pump(oddsRes, "odds"), pump(scoresRes, "score")]).finally(() => {
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        })
      );
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
