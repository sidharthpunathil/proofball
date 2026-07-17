"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useStore } from "@/lib/store";
import { listContainer, listItem, springPop, tweenFast } from "@/lib/motion";
import CoinBurst from "@/components/fx/CoinBurst";
import ShareButton from "./ShareButton";
import { Check, Close, ExternalLink, Target } from "./Icons";

export default function PickHistory({ limit = 20, showEmpty = false }: { limit?: number; showEmpty?: boolean }) {
  const history = useStore((s) => s.history);
  const current = useStore((s) => s.current);
  // The in-progress call (Rising/Falling picked, not yet settled) surfaces here
  // right away, so a call is visible the moment it is made (including on the
  // replay simulation), not only after it settles ~7s later.
  const pending =
    current && current.dir && (current.status === "open" || current.status === "locked")
      ? current
      : null;
  const reduce = useReducedMotion();
  // Track first paint. The stagger below runs only on mount; a fresh settlement
  // is a prepend that happens post-mount and instead gets the popwin/poplose
  // settlement entrance (item 1), so a result reads as one focal beat, not two.
  const mountedRef = useRef(false);
  // Micro coin-burst for a freshly-won top row. `burstKey` bumps only when a new
  // won row is prepended post-mount; `lastWonIdRef` remembers the id we last
  // fired for — seeded at mount so the initial load (or an already-won top row)
  // never fires, and a given win never double-fires.
  const [burstKey, setBurstKey] = useState(0);
  const lastWonIdRef = useRef<string | null>(null);
  useEffect(() => {
    mountedRef.current = true;
    lastWonIdRef.current = history[0]?.id ?? null;
    // Seed once on mount only; not reactive to `history`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!mountedRef.current) return;
    const top = history[0];
    if (top && top.status === "won" && top.id !== lastWonIdRef.current) {
      lastWonIdRef.current = top.id;
      setBurstKey((k) => k + 1);
    }
  }, [history]);

  if (history.length === 0 && !pending) {
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
        {pending && (
          <div className="flex items-center gap-2.5 rounded-xl border border-grn/30 bg-surface px-3 py-2 text-[13px] shadow-soft">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-grnsoft">
              <span className="h-1.5 w-1.5 rounded-full bg-grn animate-pulse2" />
            </span>
            <span className="font-semibold text-ink">{pending.dir === "up" ? "Rising" : "Falling"}</span>
            <span className="ml-auto text-[11.5px] font-medium text-mut">
              {pending.status === "locked" ? "Locked · settling" : "Called · locks soon"}
            </span>
          </div>
        )}
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
                  <span className="relative inline-flex items-center">
                    <motion.span
                      className="tabular-nums font-semibold text-grn"
                      initial={reduce || i !== 0 ? false : { opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={reduce ? tweenFast : { ...springPop, delay: 0.06 }}
                    >
                      +{p.reward}
                    </motion.span>
                    {/* Tiny reward flourish over the +reward figure; fires only on a
                        fresh post-mount win (CoinBurst self-disables under reduced motion). */}
                    {!firstPaint && i === 0 && <CoinBurst fireKey={burstKey} count={3} size={10} />}
                  </span>
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
