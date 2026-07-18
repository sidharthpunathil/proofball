"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { m, useMotionValueEvent, useReducedMotion, useSpring, type Variants } from "framer-motion";
import { ArrowUp, ArrowDown } from "./Icons";
import Flag from "./Flag";
import Segmented from "./Segmented";
import { EASE_OUT, DUR, springSoft } from "@/lib/motion";
import { toCandles, priceDomain, type Sample, type Candle } from "@/lib/candles";

interface Props {
  samples: Sample[];
  homeProb: number;
  drawProb: number;
  awayProb: number;
  home: string;
  away: string;
  homeColor: string;
  awayColor: string;
  interval: number;
  onInterval: (n: number) => void;
  flashKey: number;
}

/** Timeframe options, in minutes of match time per candle. */
const INTERVALS = [
  { value: 1, label: "1m", title: "1-minute candles" },
  { value: 5, label: "5m", title: "5-minute candles" },
  { value: 15, label: "15m", title: "15-minute candles" },
];

// Chart geometry (SVG user units; the svg itself is width:100%).
const W = 300;
const H = 118;
const PT = 8; // top padding
const PB = 15; // bottom padding (minute labels)
const PL = 3; // left padding
const PR = 34; // right gutter for the live-price tag
const PLOT_W = W - PL - PR;
const PLOT_H = H - PT - PB;
const MAX_CANDLES = 32; // visible window; older candles scroll off the left

export default function ProbabilityChart({
  samples,
  homeProb,
  drawProb,
  awayProb,
  home,
  away,
  homeColor,
  awayColor,
  interval,
  onInterval,
  flashKey,
}: Props) {
  const reduce = useReducedMotion();
  const p = Math.max(0, Math.min(100, homeProb));

  // Same count-up + direction treatment as the gauge, so switching modes keeps
  // the headline number continuous.
  const prev = useRef(p);
  const [dir, setDir] = useState<"up" | "down" | "flat">("flat");
  useEffect(() => {
    const d = p - prev.current;
    if (Math.abs(d) > 0.15) setDir(d > 0 ? "up" : "down");
    prev.current = p;
  }, [p]);

  const spring = useSpring(p, { stiffness: 200, damping: 25 });
  const [display, setDisplay] = useState(Math.round(p));
  useEffect(() => {
    if (reduce) {
      spring.jump(p);
      setDisplay(Math.round(p));
    } else spring.set(p);
  }, [p, reduce, spring]);
  useMotionValueEvent(spring, "change", (v) => setDisplay(Math.round(v)));

  const candles = useMemo(() => toCandles(samples, interval), [samples, interval]);
  const visible = candles.slice(-MAX_CANDLES);
  const n = visible.length;
  const { min, max } = priceDomain(visible);
  const span = max - min || 1;

  const y = (val: number) => PT + (1 - (val - min) / span) * PLOT_H;
  const slotW = n > 0 ? PLOT_W / n : PLOT_W;
  const cx = (i: number) => PL + slotW * (i + 0.5);
  const bodyW = Math.max(2, Math.min(slotW * 0.58, 13));

  // Glide the live-price line/tag to each new value (one springy value, never the
  // whole path, the same restraint as the sparkline, so ticks read calm, not jittery).
  const lastY = n > 0 ? y(p) : PT + PLOT_H / 2;
  const cy = useSpring(lastY, springSoft);
  useEffect(() => {
    if (reduce) cy.jump(lastY);
    else cy.set(lastY);
  }, [lastY, reduce, cy]);

  // A pre-match (or just-connected) feed has one flat price and nothing to plot.
  // Treat "no real movement yet" as empty so we show an intentional waiting
  // state instead of a lonely flat line stranded in dead space.
  const rawMax = n > 0 ? Math.max(...visible.map((c) => c.high)) : p;
  const rawMin = n > 0 ? Math.min(...visible.map((c) => c.low)) : p;
  const hasSeries = n > 0 && rawMax - rawMin > 0.5;

  const show50 = 50 >= min && 50 <= max;
  const change = hasSeries ? p - visible[0].open : 0; // move across the visible window
  const firstMin = hasSeries ? visible[0].startMin : 0;
  const lastMin = hasSeries ? visible[n - 1].startMin : 0;

  const lineStroke = dir === "up" ? "stroke-grn" : dir === "down" ? "stroke-red" : "stroke-line2";
  const dotFill = dir === "up" ? "fill-grn" : dir === "down" ? "fill-red" : "fill-mut";
  const tagFill = dir === "up" ? "fill-grnsoft" : dir === "down" ? "fill-redsoft" : "fill-subtle";

  const container: Variants = reduce
    ? { hidden: {}, show: { transition: { staggerChildren: 0 } } }
    : { hidden: {}, show: { transition: { staggerChildren: 0.015, delayChildren: 0.02 } } };
  const item: Variants = reduce
    ? { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: DUR.micro } } }
    : {
        hidden: { opacity: 0, scaleY: 0.5 },
        show: { opacity: 1, scaleY: 1, transition: { duration: DUR.fast, ease: EASE_OUT } },
      };

  return (
    <div className="relative w-full select-none">
      <div
        key={flashKey}
        className={`pointer-events-none absolute inset-0 rounded-[28px] ${
          dir === "down" ? "animate-flashDown" : "animate-flash"
        }`}
      />

      {/* Headline: current win-prob + window change (left), timeframe (right). */}
      <div className="flex items-start justify-between px-1">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="tabular-nums text-[40px] font-extrabold leading-none tracking-[-2px] text-ink">
              {display}
              <span className="text-[18px] font-semibold text-mut">%</span>
            </span>
            {hasSeries && (
              <span
                className={`mb-0.5 flex items-center gap-0.5 text-[12px] font-semibold tabular-nums ${
                  change > 0.1 ? "text-grn" : change < -0.1 ? "text-red" : "text-mut"
                }`}
              >
                {change > 0.1 && <ArrowUp size={12} />}
                {change < -0.1 && <ArrowDown size={12} />}
                {change >= 0 ? "+" : ""}
                {change.toFixed(1)}
              </span>
            )}
          </div>
          <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.4px] text-mut">
            {home} to win
          </div>
        </div>
        <Segmented
          options={INTERVALS}
          value={interval}
          onChange={onInterval}
          layoutId="chartInterval"
          ariaLabel="Candle timeframe"
        />
      </div>

      {/* Candlestick chart. */}
      <div className="relative mt-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" preserveAspectRatio="none">
          {/* 50% coin-flip reference line. */}
          {show50 && (
            <line
              x1={PL}
              x2={W - PR}
              y1={y(50)}
              y2={y(50)}
              className="stroke-line2"
              strokeWidth={1}
              strokeDasharray="1 4"
              strokeLinecap="round"
            />
          )}

          {/* Candles. Keyed by interval so a timeframe switch replays the staggered
              intro; within a timeframe, only a freshly-formed candle animates in. */}
          {hasSeries && (
            <m.g key={interval} variants={container} initial="hidden" animate="show">
              {visible.map((c, i) => (
                <CandleMark key={c.bucket} c={c} x={cx(i)} bodyW={bodyW} y={y} variants={item} />
              ))}
            </m.g>
          )}

          {/* Live-price line + tag, glided by the spring (kept outside the keyed
              group so it persists smoothly across timeframe changes). Only once
              there is a real series; pre-match the headline % carries the value. */}
          {hasSeries && (
            <m.g style={{ y: cy }}>
              <line
                x1={PL}
                x2={W - PR}
                y1={0}
                y2={0}
                className={lineStroke}
                strokeWidth={1}
                strokeDasharray="2 3"
                strokeLinecap="round"
                opacity={0.9}
              />
              {/* fill-box: pulse2 scales via CSS transform, and SVG's default
                  transform-box (view-box) would scale the dot's POSITION toward
                  the origin, making it drift instead of pulse in place. */}
              <circle
                cx={W - PR}
                cy={0}
                r={2.6}
                className={`${dotFill} animate-pulse2`}
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
              />
              <g transform={`translate(${W - PR + 3}, 0)`}>
                <rect x={0} y={-8.5} width={PR - 5} height={17} rx={4.5} className={tagFill} />
                <text
                  x={(PR - 5) / 2}
                  y={3.6}
                  textAnchor="middle"
                  className="fill-ink tabular-nums"
                  style={{ fontSize: 10.5, fontWeight: 800 }}
                >
                  {display}
                </text>
              </g>
            </m.g>
          )}

          {/* Pre-match / just-connected: no in-play moves to plot yet. */}
          {!hasSeries && (
            <>
              <text
                x={(PL + W - PR) / 2}
                y={PT + PLOT_H / 2 - 4}
                textAnchor="middle"
                className="fill-ink2"
                style={{ fontSize: 11.5, fontWeight: 700 }}
              >
                Waiting for the first moves
              </text>
              <text
                x={(PL + W - PR) / 2}
                y={PT + PLOT_H / 2 + 12}
                textAnchor="middle"
                className="fill-mut"
                style={{ fontSize: 10, fontWeight: 500 }}
              >
                Win-prob candles form as the match plays
              </text>
            </>
          )}
        </svg>
      </div>

      {/* X-axis context: window start · candle size · window end. */}
      <div className="mt-1 flex items-center justify-between px-1 text-[10px] font-medium text-faint">
        <span className="tabular-nums">{hasSeries ? `${firstMin}’` : ""}</span>
        <span className="uppercase tracking-[0.3px]">{interval}-min candles</span>
        <span className="tabular-nums">{hasSeries ? `${lastMin}’` : ""}</span>
      </div>

      {/* Legend mirrors the gauge exactly, so switching modes leaves it steady. */}
      <div className="mt-1.5 flex items-center justify-between px-1 text-[13px] font-semibold">
        <div className="flex items-center gap-1.5">
          <Flag abbr={away} color={awayColor} />
          <span className="text-mut">{away}</span>
          <span className="tabular-nums text-ink">{awayProb.toFixed(0)}%</span>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] text-mut">
          <span>Draw</span>
          <span className="tabular-nums text-ink">{drawProb.toFixed(0)}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="tabular-nums text-ink">{homeProb.toFixed(0)}%</span>
          <span className="text-mut">{home}</span>
          <Flag abbr={home} color={homeColor} />
          {dir === "up" && <ArrowUp size={14} className="text-grn" />}
          {dir === "down" && <ArrowDown size={14} className="text-red" />}
        </div>
      </div>
    </div>
  );
}

function CandleMark({
  c,
  x,
  bodyW,
  y,
  variants,
}: {
  c: Candle;
  x: number;
  bodyW: number;
  y: (v: number) => number;
  variants: Variants;
}) {
  // Literal class strings (not `stroke-${color}`) so Tailwind's JIT emits them.
  const wickClass = c.up ? "stroke-grn" : "stroke-red";
  const bodyClass = c.up ? "fill-grn" : "fill-red";
  const top = y(Math.max(c.open, c.close));
  const bottom = y(Math.min(c.open, c.close));
  const bodyH = Math.max(1.5, bottom - top);
  return (
    <m.g
      variants={variants}
      style={{ transformBox: "fill-box", transformOrigin: "center" }}
    >
      {/* wick: high → low */}
      <line
        x1={x}
        x2={x}
        y1={y(c.high)}
        y2={y(c.low)}
        className={wickClass}
        strokeWidth={1.2}
        strokeLinecap="round"
        opacity={0.75}
      />
      {/* body: open ↔ close */}
      <rect
        x={x - bodyW / 2}
        y={top}
        width={bodyW}
        height={bodyH}
        rx={1.2}
        className={bodyClass}
        opacity={0.95}
      />
    </m.g>
  );
}
