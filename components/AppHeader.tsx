"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { springPop, tweenBase, tweenFast } from "@/lib/motion";
import { useStore } from "@/lib/store";
import { useFixture } from "@/lib/fixture-context";
import { User, ChevronLeft, Check } from "./Icons";
import ThemeToggle from "./ThemeToggle";

// Deterministic gradient "identicon" from a wallet address: each key gets its
// own recognisable look, so the chip *is* the identity, not a generic silhouette.
function gradientFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(h, 31) + seed.charCodeAt(i)) >>> 0;
  const a = h % 360;
  const b = (a + 70 + ((h >>> 9) % 130)) % 360;
  return `linear-gradient(135deg, hsl(${a} 72% 56%), hsl(${b} 76% 46%))`;
}

export default function AppHeader() {
  const fixture = useFixture();
  const user = useStore((s) => s.user);
  const streak = useStore((s) => s.streak);
  const phase = useStore((s) => s.phase);
  const live = phase !== "FT" && phase !== "PRE";
  const reduce = useReducedMotion();

  const [copied, setCopied] = useState(false);
  const copyAddr = async () => {
    if (!user?.wallet) return;
    try {
      await navigator.clipboard.writeText(user.wallet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1300);
    } catch {
      /* clipboard blocked (insecure context / denied): no-op */
    }
  };

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={tweenBase}
      className="sticky top-0 z-30 flex items-center gap-2 px-4 pb-2 pt-3"
    >
      {/* identity: wallet address chip (placeholder silhouette before sign-in) */}
      <div className="relative shrink-0">
        {user ? (
          <button
            onClick={copyAddr}
            title={copied ? "Copied" : `Copy ${user.wallet}`}
            className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 shadow-soft transition-colors hover:border-line2 active:scale-[0.97]"
          >
            <span className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full ring-1 ring-black/5">
              <span className="absolute inset-0" style={{ background: gradientFor(user.wallet) }} />
              <AnimatePresence>
                {copied && (
                  <motion.span
                    initial={reduce ? { opacity: 0 } : { scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={reduce ? { opacity: 0 } : { scale: 0.4, opacity: 0 }}
                    transition={springPop}
                    className="absolute inset-0 flex items-center justify-center bg-grn text-white"
                  >
                    <Check size={16} />
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
            <span className="min-w-[68px] text-left text-[13px] font-semibold tabular-nums text-ink">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={copied ? "copied" : "addr"}
                  initial={reduce ? { opacity: 0 } : { y: -5, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={reduce ? { opacity: 0 } : { y: 5, opacity: 0 }}
                  transition={tweenFast}
                  className="block"
                >
                  {copied ? "Copied" : user.name}
                </motion.span>
              </AnimatePresence>
            </span>
          </button>
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-ink2 shadow-soft">
            <User size={19} />
          </div>
        )}

        <AnimatePresence>
          {user && streak > 0 && (
            <motion.span
              initial={reduce ? { opacity: 0 } : { scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { scale: 0.5, opacity: 0, transition: tweenFast }}
              transition={springPop}
              className="pointer-events-none absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red px-1 text-[10px] font-bold text-white"
            >
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  key={streak}
                  initial={reduce ? { opacity: 0 } : { y: -6, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={reduce ? { opacity: 0 } : { y: 6, opacity: 0 }}
                  transition={tweenFast}
                >
                  {streak}
                </motion.span>
              </AnimatePresence>
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* center match pill. mx-auto keeps it centred in the space the address
          chip and toggle leave, and min-w-0 lets it truncate rather than
          collide. Links back to the lobby to pick another match. */}
      <Link
        href="/"
        className="mx-auto flex h-8 min-w-0 max-w-[46%] items-center gap-2 rounded-full border border-line bg-surface px-3 shadow-soft transition-colors hover:border-line2"
      >
        <ChevronLeft size={14} className="shrink-0 text-mut" />
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: fixture.home.color }} />
        <span className="truncate text-[13px] font-semibold text-ink">
          {fixture.home.abbr} <span className="text-faint">·</span> {fixture.away.abbr}
        </span>
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: fixture.away.color }} />
        {live && <span className="ml-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red animate-pulse2" />}
      </Link>

      <ThemeToggle className="shrink-0 h-10 w-10" />
    </motion.div>
  );
}
