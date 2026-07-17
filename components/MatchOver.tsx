"use client";

import { motion, useReducedMotion } from "framer-motion";
import { tweenBase } from "@/lib/motion";
import { Play } from "./Icons";

/**
 * Banner shown above the prediction control on a FINISHED match. The match is
 * already over, so this is a replay simulation: you can still call the needle,
 * but only to earn leaderboard points , nothing else is at stake.
 */
export default function MatchOver() {
  const reduce = useReducedMotion();
  return (
    <div className="px-4">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={tweenBase}
        className="flex items-center gap-2.5 rounded-2xl border border-line bg-subtle px-3.5 py-2.5"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface text-amber shadow-soft">
          <Play size={13} />
        </span>
        <p className="text-[12.5px] leading-[1.4]">
          <span className="font-semibold text-ink">This match is already over.</span>{" "}
          <span className="text-ink2">You&apos;re playing the replay simulation. Calls only earn points.</span>
        </p>
      </motion.div>
    </div>
  );
}
