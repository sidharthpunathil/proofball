"use client";

import { m, useReducedMotion } from "framer-motion";
import { tweenBase } from "@/lib/motion";
import { Play } from "./Icons";

/**
 * Banner shown above the prediction control on a FINISHED match. The match is
 * already over, so you're calling the replay , but it's real play on Solana
 * devnet: every correct call mints real devnet $PROOF to your wallet on-chain.
 */
export default function MatchOver() {
  const reduce = useReducedMotion();
  return (
    <div className="px-4">
      <m.div
        initial={reduce ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={tweenBase}
        className="flex items-center gap-2.5 rounded-2xl border border-line bg-subtle px-3.5 py-2.5"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface text-amber shadow-soft">
          <Play size={13} />
        </span>
        <p className="text-[12.5px] leading-[1.4]">
          <span className="font-semibold text-ink">You can play this on Solana devnet.</span>{" "}
          <span className="text-ink2">The match already finished, so you&apos;re calling the replay , win calls to earn $PROOF and cash out to your wallet.</span>
        </p>
      </m.div>
    </div>
  );
}
