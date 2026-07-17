import { describe, it, expect } from "vitest";
import { buildReplay } from "@/lib/demo-fixture";
import type { OddsFrame, ScoreFrame } from "@/lib/types";

describe("demo replay feed", () => {
  const frames = buildReplay();

  it("produces a non-empty ordered feed with all frame kinds", () => {
    expect(frames.length).toBeGreaterThan(50);
    const kinds = new Set(frames.map((f) => f.kind));
    expect(kinds.has("odds")).toBe(true);
    expect(kinds.has("score")).toBe(true);
    expect(kinds.has("clock")).toBe(true);
  });

  it("every odds frame is a valid 1X2 triplet with parseable probabilities", () => {
    const odds = frames.filter((f): f is OddsFrame => f.kind === "odds");
    expect(odds.length).toBeGreaterThan(20);
    for (const o of odds) {
      expect(o.PriceNames).toEqual(["1", "X", "2"]);
      expect(o.Pct).toHaveLength(3);
      for (const p of o.Pct) expect(Number.isNaN(Number(p))).toBe(false);
      const sum = o.Pct.reduce((a, p) => a + Number(p), 0);
      expect(sum).toBeGreaterThan(95);
      expect(sum).toBeLessThan(105); // de-margined ≈ 100%
    }
  });

  it("score events carry a strictly increasing seq (like real TxLINE records)", () => {
    const scores = frames.filter((f): f is ScoreFrame => f.kind === "score");
    let prev = 0;
    for (const s of scores) {
      expect(s.seq).toBeGreaterThan(prev);
      prev = s.seq;
    }
  });

  it("resolves to a finalised 2–1 home win", () => {
    const finalEv = frames.find((f) => f.kind === "score" && f.action === "game_finalised") as
      | ScoreFrame
      | undefined;
    expect(finalEv).toBeDefined();
    expect(finalEv!.scoreH).toBe(2);
    expect(finalEv!.scoreA).toBe(1);
  });

  it("ends with the market favouring the home side", () => {
    const odds = frames.filter((f): f is OddsFrame => f.kind === "odds");
    const last = odds[odds.length - 1];
    const home = Number(last.Pct[0]);
    const away = Number(last.Pct[2]);
    expect(home).toBeGreaterThan(away);
    expect(home).toBeGreaterThan(50);
  });
});
