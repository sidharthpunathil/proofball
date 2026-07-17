import { describe, it, expect } from "vitest";
import { probsFromOdds, homeWinPct, clamp } from "@/lib/winprob";
import type { OddsFrame } from "@/lib/types";

const frame: OddsFrame = {
  kind: "odds",
  PriceNames: ["1", "X", "2"],
  Pct: ["52.6", "28.6", "18.8"],
  SuperOddsType: "1X2",
  delay: 0,
};

describe("winprob", () => {
  it("maps Pct directly to probabilities aligned to PriceNames", () => {
    const probs = probsFromOdds(frame);
    expect(probs).toHaveLength(3);
    expect(probs[0]).toEqual({ name: "1", prob: 0.526 });
    expect(probs[2].name).toBe("2");
  });

  it("returns null for NA lines (quarter-handicap)", () => {
    const na = probsFromOdds({ ...frame, Pct: ["NA", "NA", "NA"] });
    expect(na.every((p) => p.prob === null)).toBe(true);
  });

  it("reads home win % from selection '1'", () => {
    expect(homeWinPct(frame)).toBe(52.6);
  });

  it("returns null when home selection is NA", () => {
    expect(homeWinPct({ ...frame, Pct: ["NA", "28.6", "18.8"] })).toBeNull();
  });

  it("clamps within bounds", () => {
    expect(clamp(120, 0, 100)).toBe(100);
    expect(clamp(-5, 0, 100)).toBe(0);
    expect(clamp(42, 0, 100)).toBe(42);
  });
});
