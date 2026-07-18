"use client";

import { m, useReducedMotion, type Variants } from "framer-motion";
import { EASE_OUT, springPop } from "@/lib/motion";
import { Flame } from "@/components/Icons";

/**
 * RewardLadder, a small bar chart on /how-it-works showing how a winning streak
 * grows each correct call's payout. The numbers are the real in-app formula
 * (see PredictControl): reward = 50 + min(streak, 6) x 15 $PROOF, capping at 6
 * in a row. Triggered when scrolled into view (it sits far below the fold, so a
 * mount animation would finish unseen): bars climb left to right, then the
 * flame pops on the top step.
 */
const STEPS = Array.from({ length: 7 }, (_, streak) => ({
  streak,
  reward: 50 + Math.min(streak, 6) * 15,
}));
const MAX = 140;
const STAGGER = 0.07;
// Relative to its own (last, most-staggered) column's start, so the flame pops
// just as that bar finishes its 0.45s rise.
const T_FLAME = 0.5;

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: STAGGER, delayChildren: 0.05 } },
};
const column: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } },
};
const bar: Variants = {
  hidden: { scaleY: 0 },
  show: { scaleY: 1, transition: { duration: 0.45, ease: EASE_OUT } },
};
const label: Variants = {
  hidden: { opacity: 0, y: 5 },
  show: { opacity: 1, y: 0, transition: { delay: 0.22, duration: 0.3, ease: EASE_OUT } },
};
const flamePop: Variants = {
  hidden: { opacity: 0, scale: 0 },
  show: { opacity: 1, scale: 1, transition: { delay: T_FLAME, ...springPop } },
};

export default function RewardLadder() {
  const reduce = useReducedMotion();

  return (
    <m.div
      className="w-full select-none"
      initial={reduce ? false : "hidden"}
      whileInView={reduce ? undefined : "show"}
      viewport={{ once: true, margin: "-40px" }}
    >
      <m.div className="flex items-end justify-between gap-1.5" style={{ height: 132 }} variants={container}>
        {STEPS.map(({ streak, reward }) => {
          const hot = streak >= 3;
          const top = streak === 6;
          // 28px floor so the smallest bar still reads; scale the rest to MAX.
          const h = 28 + ((reward - 50) / (MAX - 50)) * 96;
          return (
            <m.div key={streak} variants={column} className="flex flex-1 flex-col items-center justify-end gap-1">
              <m.span
                variants={label}
                className={`text-[10.5px] font-bold tabular-nums ${top ? "text-grn" : hot ? "text-amber" : "text-mut"}`}
              >
                +{reward}
              </m.span>
              <m.div
                className={`w-full origin-bottom rounded-t-[5px] ${
                  top ? "bg-grn" : hot ? "bg-amber/70" : "bg-line2"
                }`}
                style={{ height: h }}
                variants={bar}
              >
                {top && (
                  <m.span variants={flamePop} className="flex justify-center pt-1 text-bg">
                    <Flame size={12} />
                  </m.span>
                )}
              </m.div>
            </m.div>
          );
        })}
      </m.div>

      {/* streak axis */}
      <div className="mt-1.5 flex items-center justify-between gap-1.5">
        {STEPS.map(({ streak }) => (
          <span key={streak} className="flex-1 text-center text-[10px] font-semibold tabular-nums text-faint">
            {streak === 0 ? "0" : `×${streak}`}
          </span>
        ))}
      </div>
      <div className="mt-2 text-center text-[11px] font-semibold uppercase tracking-[0.1em] text-mut">
        Wins in a row → bigger $PROOF payout
      </div>
    </m.div>
  );
}
