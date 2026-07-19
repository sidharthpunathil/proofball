// OHLC candle aggregation for the win-probability timeline chart.
//
// Candles are bucketed by MATCH MINUTE, never wall-clock. A finished match
// replays its whole event log compressed into a few real seconds, so wall-clock
// buckets would collapse into one bar; bucketing on the in-game minute keeps the
// chart stable at any replay speed and gives every candle a real meaning:
// candle k spans match minutes [k*interval, (k+1)*interval). Same idea as a
// trading chart's timeframe, but the "time" axis is the football clock.

/** One minute-stamped home win-probability reading (see store.ingest). */
export interface Sample {
  m: number; // match minute at the moment this odds tick arrived
  p: number; // home win probability, %
}

/** An open/high/low/close bar for one interval bucket. */
export interface Candle {
  bucket: number; // interval index (minute floor / interval)
  startMin: number; // inclusive match-minute this candle opens at
  open: number;
  high: number;
  low: number;
  close: number;
  up: boolean; // green when the body rises (or a flat doji sits at/above the prior close), else red
}

/**
 * Aggregate chronological samples into OHLC candles of `interval` match-minutes.
 *
 * The first reading in a bucket is the open, the last is the close, and high/low
 * track the extremes between. Empty buckets are omitted rather than filled with
 * synthetic flats; a sparse in-play feed genuinely has quiet minutes, and gaps
 * read more honestly than invented dojis. Samples are expected in ingest order;
 * out-of-order input is tolerated (buckets are re-sorted) but open/close then
 * follow arrival order within a bucket, which is what a live tape would show.
 */
export function toCandles(samples: Sample[], interval: number): Candle[] {
  if (interval <= 0 || samples.length === 0) return [];

  const byBucket = new Map<number, Candle>();
  for (const s of samples) {
    if (!Number.isFinite(s.p)) continue;
    const bucket = Math.floor(s.m / interval);
    const existing = byBucket.get(bucket);
    if (!existing) {
      byBucket.set(bucket, {
        bucket,
        startMin: bucket * interval,
        open: s.p,
        high: s.p,
        low: s.p,
        close: s.p,
        up: true,
      });
    } else {
      existing.high = Math.max(existing.high, s.p);
      existing.low = Math.min(existing.low, s.p);
      existing.close = s.p;
    }
  }

  const candles = [...byBucket.values()].sort((a, b) => a.bucket - b.bucket);
  // Direction/colour: a candle with a real body goes by close vs open. A flat
  // doji minute (common on the 1m tape, where a bucket often holds a single
  // reading so open == close) has no body of its own, so it follows the trend:
  // close vs the PREVIOUS candle's close. Without this, every flat bar defaults
  // to green and a plainly falling market renders as a green staircase.
  let prevClose: number | null = null;
  for (const c of candles) {
    c.up =
      c.close > c.open
        ? true
        : c.close < c.open
          ? false
          : prevClose === null
            ? true
            : c.close >= prevClose;
    prevClose = c.close;
  }
  return candles;
}

/**
 * Vertical value range for a set of candles, padded and floored to a minimum
 * span so a tight, barely-moving match still renders bars with real height
 * instead of a flat line. Clamped to the valid probability range [0, 100].
 */
export function priceDomain(candles: Candle[], pad = 5, minSpan = 11): { min: number; max: number } {
  if (candles.length === 0) return { min: 40, max: 60 };
  let lo = Infinity;
  let hi = -Infinity;
  for (const c of candles) {
    if (c.low < lo) lo = c.low;
    if (c.high > hi) hi = c.high;
  }
  lo -= pad;
  hi += pad;
  const span = hi - lo;
  if (span < minSpan) {
    const mid = (hi + lo) / 2;
    lo = mid - minSpan / 2;
    hi = mid + minSpan / 2;
  }
  return { min: Math.max(0, lo), max: Math.min(100, hi) };
}
