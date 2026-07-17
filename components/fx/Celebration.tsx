"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useStore } from "@/lib/store";
import { EASE_OUT, springPop } from "@/lib/motion";
import { Flame, Trophy } from "../Icons";

// The delight budget lives here: a full-screen celebration is reserved for the
// genuinely RARE moments — a new personal-best streak, or every 5th call in a
// row — never the every-~15s settlement (that gets the quiet PickHistory pop).
interface Fire {
  n: number;
  streak: number;
  newBest: boolean;
}

const CONFETTI = [
  "rgb(var(--grn))",
  "rgb(var(--amber))",
  "rgb(var(--violet))",
  "rgb(var(--red))",
  "rgb(var(--blue))",
];

export default function Celebration() {
  const lastResult = useStore((s) => s.lastResult);
  const reduce = useReducedMotion();
  const [fire, setFire] = useState<Fire | null>(null);
  const seen = useRef(0);

  useEffect(() => {
    if (!lastResult || lastResult.n === seen.current) return;
    seen.current = lastResult.n;
    const { outcome, streak, newBest } = lastResult;
    const milestone = outcome === "won" && (newBest || (streak > 0 && streak % 5 === 0));
    if (!milestone) return;
    setFire({ n: lastResult.n, streak, newBest });
    const t = window.setTimeout(() => setFire(null), 2000);
    return () => window.clearTimeout(t);
  }, [lastResult]);

  return (
    <AnimatePresence>
      {fire && (
        <motion.div
          key={fire.n}
          className="pointer-events-none absolute inset-0 z-[70] flex items-start justify-center overflow-hidden"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* confetti — skipped entirely under reduced motion */}
          {!reduce &&
            Array.from({ length: 26 }).map((_, i) => {
              const left = (i * 37) % 100; // deterministic spread, no Math.random
              const color = CONFETTI[i % CONFETTI.length];
              const delay = (i % 6) * 0.04;
              const drift = ((i % 5) - 2) * 14;
              const rotate = (i % 2 ? 1 : -1) * (120 + (i % 3) * 80);
              return (
                <motion.span
                  key={i}
                  className="absolute top-0 h-2.5 w-1.5 rounded-[1px]"
                  style={{ left: `${left}%`, background: color }}
                  initial={{ y: -20, x: 0, opacity: 0, rotate: 0 }}
                  animate={{ y: 520, x: drift, opacity: [0, 1, 1, 0], rotate }}
                  transition={{ duration: 1.5 + (i % 4) * 0.15, ease: EASE_OUT, delay, times: [0, 0.1, 0.8, 1] }}
                />
              );
            })}

          {/* banner */}
          <motion.div
            className="mt-24 flex items-center gap-2.5 rounded-full border border-line bg-surface/95 px-4 py-2.5 shadow-card backdrop-blur-md"
            initial={reduce ? { opacity: 0 } : { scale: 0.7, opacity: 0, y: -8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { scale: 0.9, opacity: 0 }}
            transition={reduce ? { duration: 0.2 } : springPop}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber/15 text-amber">
              {fire.newBest ? <Trophy size={16} /> : <Flame size={16} />}
            </span>
            <span className="text-[14px] font-extrabold tracking-tight text-ink">
              {fire.newBest ? "New best streak" : `${fire.streak} in a row!`}
            </span>
            <span className="rounded-full bg-ink px-2 py-0.5 text-[12px] font-bold tabular-nums text-bg">
              ×{fire.streak}
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
