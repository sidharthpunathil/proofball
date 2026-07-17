"use client";

import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useStore } from "@/lib/store";
import { listContainer, listItem, springSoft } from "@/lib/motion";
import { Trophy, Flame } from "./Icons";

export default function Leaderboard() {
  const board = useStore((s) => s.leaderboard);
  const syncLeaderboard = useStore((s) => s.syncLeaderboard);
  const reduce = useReducedMotion();

  // Pull the shared (Redis) board on open and keep it fresh, so other players'
  // points show up here too , this is the multi-user view.
  useEffect(() => {
    void syncLeaderboard();
    const iv = setInterval(() => void syncLeaderboard(), 5000);
    return () => clearInterval(iv);
  }, [syncLeaderboard]);

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
        <motion.div
          className="overflow-hidden rounded-[22px] border border-line bg-surface shadow-soft"
          variants={reduce ? undefined : listContainer}
          initial={reduce ? false : "hidden"}
          animate="show"
        >
          {board.slice(0, 8).map((r, i) => (
          <motion.div
            key={r.name}
            layout={!reduce}
            variants={reduce ? undefined : listItem}
            transition={{ layout: springSoft }}
            className={`flex items-center gap-3 px-4 py-3.5 ${i > 0 ? "border-t border-line" : ""} ${
              r.you ? "bg-grnsoft" : ""
            }`}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold tabular-nums ${
                i < 3 ? "bg-ink text-bg" : "bg-subtle text-mut"
              }`}
            >
              {i + 1}
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
              <span className="tabular-nums text-[14px] font-bold text-ink">{r.coins.toLocaleString()}</span>
            </span>
          </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
