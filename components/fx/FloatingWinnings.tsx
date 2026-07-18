"use client";

import { m, useReducedMotion } from "framer-motion";
import { EASE_OUT } from "@/lib/motion";

/**
 * Ambient "money in the air" flourish for the featured match card: little
 * `+N $PROOF` tickers that drift upward and fade on a loop — green for the up
 * side, red for the down — the tease that there are winnings to be called here.
 *
 * Purely decorative: renders nothing under reduced motion and never intercepts
 * pointer events. Sits over the card (z-10) in the side margins, clear of the
 * centred team names, so the effect reads without smothering the content. The
 * parent must be `relative overflow-hidden` (to clip the tickers to the card).
 */

type Tone = "grn" | "red";
type Ticker = {
  x: number; // left offset, % of card width
  base: number; // start height, % from card bottom
  amt: number; // the +$PROOF figure
  tone: Tone;
  delay: number; // stagger start, s
  dur: number; // rise+fade duration, s
  drift: number; // horizontal sway, px
  rise: number; // travel distance, px
};

// Hand-tuned, deterministic set — no randomness, so it's SSR-stable (no
// hydration mismatch) and only ~2–3 tickers are ever visible at once. Green
// hugs the left margin, red the right, scattered in height, mirroring a
// two-outcome (up/down) market.
const TICKERS: Ticker[] = [
  { x: 7, base: 35, amt: 50, tone: "grn", delay: 0.0, dur: 3.6, drift: -6, rise: 56 },
  { x: 18, base: 28, amt: 28, tone: "grn", delay: 1.3, dur: 3.9, drift: 5, rise: 62 },
  { x: 28, base: 42, amt: 15, tone: "grn", delay: 2.6, dur: 3.4, drift: -4, rise: 50 },
  { x: 70, base: 39, amt: 25, tone: "red", delay: 0.7, dur: 3.7, drift: 6, rise: 58 },
  { x: 80, base: 30, amt: 12, tone: "red", delay: 2.0, dur: 3.3, drift: -5, rise: 54 },
  { x: 88, base: 44, amt: 6, tone: "red", delay: 3.0, dur: 4.0, drift: 4, rise: 64 },
];

export default function FloatingWinnings({ className = "" }: { className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return null;

  return (
    <div className={`pointer-events-none absolute inset-0 z-10 overflow-hidden ${className}`} aria-hidden>
      {TICKERS.map((t, i) => (
        <m.span
          key={i}
          className={`absolute flex items-center gap-[3px] text-[11px] font-extrabold tabular-nums drop-shadow-sm ${
            t.tone === "grn" ? "text-grn" : "text-red"
          }`}
          style={{ left: `${t.x}%`, bottom: `${t.base}%` }}
          initial={{ opacity: 0, y: 6, scale: 0.8 }}
          animate={{
            opacity: [0, 0.85, 0.85, 0],
            y: [6, -t.rise * 0.4, -t.rise * 0.75, -t.rise],
            x: [0, t.drift * 0.5, t.drift, t.drift * 0.7],
            scale: [0.8, 1, 1, 0.92],
          }}
          transition={{
            duration: t.dur,
            delay: t.delay,
            repeat: Infinity,
            repeatDelay: 1.1,
            ease: EASE_OUT,
            times: [0, 0.25, 0.7, 1],
          }}
        >
          +{t.amt}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/proof-mark.png" alt="" className="h-auto w-[11px]" />
        </m.span>
      ))}
    </div>
  );
}
