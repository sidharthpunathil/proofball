"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { useStore } from "@/lib/store";
import { DUR, EASE_OUT, listContainer, listItem, springPop, springSoft } from "@/lib/motion";
import { ArrowUp, Trophy, Flame } from "./Icons";

export default function Leaderboard() {
  const board = useStore((s) => s.leaderboard);
  const syncLeaderboard = useStore((s) => s.syncLeaderboard);
  const reduce = useReducedMotion();

  // One-shot flourish tokens for YOUR row. Each holds a fresh id while active
  // and is cleared to null by a ~700ms timeout, so keying framer visuals on it
  // replays them exactly once per qualifying edge.
  const [climb, setClimb] = useState<number | null>(null); // you moved up: pulse + arrow
  const [top3, setTop3] = useState<number | null>(null); // you crossed into the top 3: chip pop
  // Your row's index (within the rendered top-8) on the previous board. null
  // until first measured so nothing fires on mount / first populate.
  const prevIdxRef = useRef<number | null>(null);

  // Pull the shared (Redis) board on open and keep it fresh, so other players'
  // points show up here too , this is the multi-user view.
  useEffect(() => {
    void syncLeaderboard();
    const iv = setInterval(() => void syncLeaderboard(), 5000);
    return () => clearInterval(iv);
  }, [syncLeaderboard]);

  // Edge-detect YOUR row climbing. The 5s poll constantly reorders everyone, so
  // we only ever compare your own index and fire strictly when it DECREASES.
  useEffect(() => {
    const idx = board.slice(0, 8).findIndex((r) => r.you);
    const prev = prevIdxRef.current;
    prevIdxRef.current = idx;
    // Need a valid previous position and a current one in view to call it a climb.
    if (prev == null || prev < 0 || idx < 0 || idx >= prev) return;
    const token = Date.now();
    setClimb(token);
    if (prev >= 3 && idx < 3) setTop3(token); // just entered the top 3
  }, [board]);

  // Auto-clear the one-shot tokens shortly after they fire.
  useEffect(() => {
    if (climb == null) return;
    const t = setTimeout(() => setClimb(null), 700);
    return () => clearTimeout(t);
  }, [climb]);
  useEffect(() => {
    if (top3 == null) return;
    const t = setTimeout(() => setTop3(null), 700);
    return () => clearTimeout(t);
  }, [top3]);

  return (
    <div className="px-4">
      <div className="mb-3 flex items-center gap-2 px-1">
        <Trophy size={19} className="text-ink" />
        <span className="text-[18px] font-bold tracking-tight text-ink">Leaderboard</span>
      </div>
      {board.length === 0 ? (
        <div className="rounded-[22px] border border-line bg-surface px-6 py-10 text-center shadow-soft">
          <p className="text-[14px] font-semibold text-ink">No calls on the board yet</p>
          <p className="mx-auto mt-1 max-w-[15rem] text-[13px] leading-[1.5] text-mut">
            Connect a wallet, call the win-probability, and be the first to score.
          </p>
        </div>
      ) : (
        <m.div
          className="overflow-hidden rounded-[22px] border border-line bg-surface shadow-soft"
          variants={reduce ? undefined : listContainer}
          initial={reduce ? false : "hidden"}
          animate="show"
        >
          {board.slice(0, 8).map((r, i) => {
            const youClimb = r.you && climb != null; // your climb pulse/arrow is live
            const youTop3 = r.you && top3 != null && !reduce; // your top-3 chip pop is live
            return (
            <m.div
              key={r.name}
              layout={!reduce}
              variants={reduce ? undefined : listItem}
              transition={{ layout: springSoft }}
              className={`relative flex items-center gap-3 px-4 py-3.5 ${i > 0 ? "border-t border-line" : ""} ${
                r.you ? "bg-grnsoft" : ""
              }`}
            >
              {/* Climb pulse: a green tint over your row that fades over ~0.6s.
                  Kept for reduced motion too — it's a fade, not travel. */}
              <AnimatePresence>
                {youClimb && (
                  <m.span
                    key={`pulse-${climb}`}
                    className="pointer-events-none absolute inset-0 bg-grn/15"
                    initial={{ opacity: 1 }}
                    animate={{ opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6, ease: EASE_OUT }}
                  />
                )}
              </AnimatePresence>
              <span className="relative flex shrink-0 items-center">
                <m.span
                  key={youTop3 ? `chip-${top3}` : "chip"}
                  initial={youTop3 ? { scale: 0.7 } : false}
                  animate={youTop3 ? { scale: 1 } : undefined}
                  transition={springPop}
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold tabular-nums ${
                    i < 3 ? "bg-ink text-bg" : "bg-subtle text-mut"
                  }`}
                >
                  {i + 1}
                </m.span>
                {/* Rank-up arrow: appears beside your chip and fades over DUR.base.
                    Skipped under reduced motion (no appearance/travel). */}
                <AnimatePresence>
                  {youClimb && !reduce && (
                    <m.span
                      key={`arrow-${climb}`}
                      className="pointer-events-none absolute left-full ml-1 text-grn"
                      initial={{ opacity: 0, y: 5, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -3 }}
                      transition={{ duration: DUR.base, ease: EASE_OUT }}
                    >
                      <ArrowUp size={14} strokeWidth={2.5} />
                    </m.span>
                  )}
                </AnimatePresence>
              </span>
              <span className={`min-w-0 truncate text-[14px] font-semibold ${r.you ? "text-grn" : "text-ink"}`}>
                {r.name}
                {r.you && <span className="ml-1.5 text-[11px] font-medium text-grn">you</span>}
              </span>
              <span className="ml-auto flex shrink-0 items-center gap-3">
                <span className="flex items-center gap-1 tabular-nums text-[12px] text-mut">
                  <Flame size={12} className="text-amber" />
                  {r.streak}
                </span>
                <span className="flex items-center gap-1 tabular-nums text-[14px] font-bold text-ink">
                  <img src="/proof-mark.png" alt="$PROOF" className="h-auto w-[18px] shrink-0" />
                  {r.coins.toLocaleString()}
                </span>
              </span>
            </m.div>
            );
          })}
        </m.div>
      )}
    </div>
  );
}
