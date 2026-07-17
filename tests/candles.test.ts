import { describe, it, expect } from "vitest";
import { toCandles, priceDomain, type Sample } from "@/lib/candles";

describe("toCandles", () => {
  it("returns nothing for empty input or a non-positive interval", () => {
    expect(toCandles([], 5)).toEqual([]);
    expect(toCandles([{ m: 3, p: 50 }], 0)).toEqual([]);
  });

  it("buckets by match minute with open/high/low/close in arrival order", () => {
    const samples: Sample[] = [
      { m: 0, p: 50 }, // bucket 0 opens
      { m: 2, p: 55 }, // high so far
      { m: 4, p: 48 }, // low so far, and the close of bucket 0
      { m: 5, p: 60 }, // bucket 1 opens
      { m: 9, p: 58 }, // bucket 1 closes
    ];
    const candles = toCandles(samples, 5);
    expect(candles).toHaveLength(2);
    expect(candles[0]).toMatchObject({ bucket: 0, startMin: 0, open: 50, high: 55, low: 48, close: 48, up: false });
    expect(candles[1]).toMatchObject({ bucket: 1, startMin: 5, open: 60, high: 60, low: 58, close: 58, up: false });
  });

  it("marks a candle up when it closes at or above its open", () => {
    const [c] = toCandles(
      [
        { m: 0, p: 40 },
        { m: 1, p: 45 },
      ],
      5
    );
    expect(c.up).toBe(true);
  });

  it("collapses to a single flat candle (open=high=low=close) with one reading", () => {
    const candles = toCandles([{ m: 7, p: 42 }], 5);
    expect(candles).toHaveLength(1);
    expect(candles[0]).toMatchObject({ bucket: 1, startMin: 5, open: 42, high: 42, low: 42, close: 42 });
  });

  it("omits quiet buckets instead of inventing flats, and sorts out-of-order input", () => {
    const candles = toCandles(
      [
        { m: 30, p: 55 }, // bucket 2 arrives first
        { m: 2, p: 50 }, // bucket 0
      ],
      15
    );
    expect(candles.map((c) => c.bucket)).toEqual([0, 2]); // no empty bucket 1
  });

  it("uses match-minute buckets, so replay speed never changes the result", () => {
    const play: Sample[] = Array.from({ length: 20 }, (_, i) => ({ m: i, p: 50 + i }));
    expect(toCandles(play, 5)).toHaveLength(4); // minutes 0-19 -> four 5-min candles
  });

  it("ignores non-finite readings", () => {
    const candles = toCandles([{ m: 0, p: NaN }, { m: 0, p: 50 }], 5);
    expect(candles[0]).toMatchObject({ open: 50, close: 50 });
  });
});

describe("priceDomain", () => {
  it("pads the extremes and clamps to the valid probability range", () => {
    const { min, max } = priceDomain(toCandles([{ m: 0, p: 2 }, { m: 1, p: 97 }], 5), 6, 14);
    expect(min).toBe(0); // 2 - 6 clamped up to 0
    expect(max).toBe(100); // 97 + 6 clamped down to 100
  });

  it("enforces a minimum span so a flat match still shows body height", () => {
    const { min, max } = priceDomain(toCandles([{ m: 0, p: 50 }, { m: 1, p: 50 }], 5), 0, 14);
    expect(max - min).toBeCloseTo(14);
    expect((min + max) / 2).toBeCloseTo(50);
  });

  it("falls back to a sane band when there are no candles", () => {
    expect(priceDomain([])).toEqual({ min: 40, max: 60 });
  });
});
