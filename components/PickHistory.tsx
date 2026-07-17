"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useStore } from "@/lib/store";
import { listContainer, listItem, springPop, tweenFast } from "@/lib/motion";
import ShareButton from "./ShareButton";
import { Check, Close, ExternalLink, Target } from "./Icons";

export default function PickHistory({ limit = 20, showEmpty = false }: { limit?: number; showEmpty?: boolean }) {
  const history = useStore((s) => s.history);
  const reduce = useReducedMotion();
  // Track first paint. The stagger below runs only on mount; a fresh settlement
  // is a prepend that happens post-mount and instead gets the popwin/poplose
  // settlement entrance (item 1), so a result reads as one focal beat, not two.
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
  }, []);

  if (history.length === 0) {
    if (!showEmpty) return null;
    return (
      <div className="px-4">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-mut">Your calls</div>
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface px-6 py-8 text-center shadow-soft">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-subtle text-ink2">
            <Target size={22} />
          </span>
          <div className="text-[14px] font-semibold text-ink">No calls yet</div>
          <p className="text-[12.5px] leading-[1.5] text-ink2">
            Head to the <b className="text-ink">Match</b> tab and call which way the win-probability moves. Your
            settled calls show up here.
          </p>
        </div>
      </div>
    );
  }

  // First paint only: the whole list staggers in (opacity + a gentle rise, or
  // opacity only under reduced motion). After mount, prepended rows skip the
  // stagger and use popwin/poplose, so the cascade never re-fires on a new pick.
  const firstPaint = !mountedRef.current;
  // Cap the first-paint cascade: staggering all `limit` rows tails to ~1s and
  // animates rows past the fold unseen. Only the first few stagger; the rest
  // appear immediately alongside them.
  const STAGGER_CAP = 6;
  const itemVariant = reduce
    ? { hidden: { opacity: 0 }, show: { opacity: 1, transition: tweenFast } }
    : listItem;

  return (
    <div className="px-4">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-mut">Your calls</div>
      <motion.div className="flex flex-col gap-1.5" variants={listContainer} initial="hidden" animate="show">
        {history.slice(0, limit).map((p, i) => {
          const won = p.status === "won";
          // Settlement entrance for a freshly prepended top row (post-mount only):
          // a celebratory overshoot on a win, a calm settle on a loss.
          const entrance = firstPaint || i !== 0 ? "" : won ? "animate-popwin" : "animate-poplose";
          return (
            <motion.div
              key={p.id}
              variants={firstPaint && i < STAGGER_CAP ? itemVariant : undefined}
              initial={firstPaint && i < STAGGER_CAP ? undefined : false}
              className={`flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2 text-[13px] shadow-soft ${entrance}`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full ${
                  won ? "bg-grnsoft text-grn" : "bg-redsoft text-red"
                }`}
              >
                {won ? <Check size={14} /> : <Close size={14} />}
              </span>
              <span className="font-semibold text-ink">{p.dir === "up" ? "Rising" : "Falling"}</span>
              <span className="tabular-nums text-mut">
                {p.delta != null && (p.delta > 0 ? "+" : "")}
                {p.delta?.toFixed(1)}%
              </span>
              <span className="ml-auto flex items-center gap-2">
                {won && (
                  <motion.span
                    className="tabular-nums font-semibold text-grn"
                    initial={reduce || i !== 0 ? false : { opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={reduce ? tweenFast : { ...springPop, delay: 0.06 }}
                  >
                    +{p.reward}
                  </motion.span>
                )}
                {won && <ShareButton pick={p} />}
                {p.verifyUrl && (
                  <a
                    href={p.verifyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 rounded-md border border-line bg-subtle px-1.5 py-1 text-[10px] font-semibold text-ink2 transition-transform active:scale-[0.96] hover:text-ink"
                    title="Verify this settlement on Solana"
                  >
                    <ExternalLink size={12} /> verify
                  </a>
                )}
              </span>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
