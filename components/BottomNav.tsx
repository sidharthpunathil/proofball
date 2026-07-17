"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Grid, Trophy, Gift, Activity, User } from "./Icons";

export type Tab = "match" | "board" | "earn" | "activity" | "profile";

const TABS: { id: Tab; label: string; Icon: (p: { size?: number }) => React.ReactElement }[] = [
  { id: "match", label: "Match", Icon: Grid },
  { id: "board", label: "Board", Icon: Trophy },
  { id: "earn", label: "Earn", Icon: Gift },
  { id: "activity", label: "Activity", Icon: Activity },
  { id: "profile", label: "Profile", Icon: User },
];

export default function BottomNav({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const reduce = useReducedMotion();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2">
      <div className="pointer-events-auto flex w-full max-w-md items-center justify-between gap-1 rounded-[26px] border border-line bg-surface/85 px-2 py-2 shadow-card backdrop-blur-xl">
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex flex-1 flex-col items-center gap-1 rounded-[18px] py-1 text-[10px] font-medium transition-colors ${
                active ? "text-ink" : "text-mut"
              }`}
            >
              <span className="relative flex h-9 w-9 items-center justify-center rounded-full">
                {active && (
                  <motion.span
                    layoutId="navActive"
                    className="absolute inset-0 rounded-full bg-ink"
                    transition={
                      reduce
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 320, damping: 30 }
                    }
                  />
                )}
                <span className={`relative z-10 transition-colors ${active ? "text-bg" : "text-mut"}`}>
                  <Icon size={18} />
                </span>
              </span>
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
