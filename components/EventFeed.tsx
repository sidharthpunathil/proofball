"use client";

import { m, AnimatePresence, useReducedMotion } from "framer-motion";
import { useStore } from "@/lib/store";
import { useFixture } from "@/lib/fixture-context";
import { springPop, tweenFast } from "@/lib/motion";

export default function EventFeed() {
  const events = useStore((s) => s.events);
  const fixture = useFixture();
  const reduce = useReducedMotion();
  if (events.length === 0) return null;

  return (
    <div className="px-4">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-mut">Match events</span>
        <span className="text-[11px] font-medium tabular-nums text-faint">{events.length}</span>
      </div>
      {/* The full event log, newest first, scrolling horizontally — as many real
          events (goals, shots, corners, cards…) as the feed has delivered. */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        <AnimatePresence initial={false}>
          {events.map((e) => {
            const color =
              e.team === "home" ? fixture.home.color : e.team === "away" ? fixture.away.color : "rgb(var(--mut))";
            return (
              <m.div
                key={e.id}
                layout
                initial={reduce ? false : { opacity: 0, x: -16, scale: e.big ? 0.82 : 0.94 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, scale: reduce ? 1 : 0.94, x: reduce ? 0 : -8, transition: tweenFast }}
                transition={e.big ? springPop : { type: "spring", stiffness: 260, damping: 26 }}
                className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-[12px] shadow-soft ${
                  e.big ? "border-grn/40 bg-grnsoft" : "border-line bg-surface"
                }`}
              >
                <span className="tabular-nums font-semibold text-mut">{e.minute}&apos;</span>
                <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                <span className={`whitespace-nowrap font-medium ${e.big ? "text-ink" : "text-ink2"}`}>
                  {e.label}
                </span>
              </m.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
