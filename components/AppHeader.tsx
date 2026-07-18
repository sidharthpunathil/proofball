"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AnimatePresence, m, useMotionValueEvent, useReducedMotion, useSpring } from "framer-motion";
import { springPop, springSoft, tweenBase, tweenFast } from "@/lib/motion";
import { useStore } from "@/lib/store";
import { useFixture } from "@/lib/fixture-context";
import { User, ChevronLeft, Check } from "./Icons";
import ThemeToggle from "./ThemeToggle";
import MuteButton from "./MuteButton";
import Flag from "./Flag";
import { playSound } from "@/lib/sound";

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
  const coins = useStore((s) => s.coins);
  const phase = useStore((s) => s.phase);
  const live = phase !== "FT" && phase !== "PRE";
  const reduce = useReducedMotion();

  const [copied, setCopied] = useState(false);
  const copyAddr = async () => {
    if (!user?.wallet) return;
    try {
      await navigator.clipboard.writeText(user.wallet);
      setCopied(true);
      playSound("copy");
      window.setTimeout(() => setCopied(false), 1300);
    } catch {
      /* clipboard blocked (insecure context / denied): no-op */
    }
  };

  return (
    <m.div
      initial={reduce ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={tweenBase}
      className="sticky top-0 z-30 flex items-center gap-2 px-4 pb-2 pt-3"
    >
      {/* identity: wallet avatar (gradient identicon = the identity; the full
          address is redundant next to the match pill + score + controls on the
          393px screen, so we drop it here and keep it a click-to-copy. Silhouette
          before sign-in). */}
      <div className="relative shrink-0">
        {user ? (
          <button
            type="button"
            onClick={copyAddr}
            title={copied ? "Copied" : `Copy ${user.wallet}`}
            className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full shadow-soft ring-1 ring-black/5 transition-transform active:scale-[0.94]"
          >
            <span className="absolute inset-0" style={{ background: gradientFor(user.wallet) }} />
            <AnimatePresence>
              {copied && (
                <m.span
                  initial={reduce ? { opacity: 0 } : { scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={reduce ? { opacity: 0 } : { scale: 0.4, opacity: 0 }}
                  transition={springPop}
                  className="absolute inset-0 flex items-center justify-center bg-grn text-white"
                >
                  <Check size={16} />
                </m.span>
              )}
            </AnimatePresence>
          </button>
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-ink2 shadow-soft">
            <User size={19} />
          </div>
        )}

        <AnimatePresence>
          {user && streak > 0 && (
            <m.span
              initial={reduce ? { opacity: 0 } : { scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { scale: 0.5, opacity: 0, transition: tweenFast }}
              transition={springPop}
              className="pointer-events-none absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red px-1 text-[10px] font-bold text-white"
            >
              <AnimatePresence initial={false} mode="popLayout">
                <m.span
                  key={streak}
                  initial={reduce ? { opacity: 0 } : { y: -6, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={reduce ? { opacity: 0 } : { y: 6, opacity: 0 }}
                  transition={tweenFast}
                >
                  {streak}
                </m.span>
              </AnimatePresence>
            </m.span>
          )}
        </AnimatePresence>
      </div>

      {/* center match pill. mx-auto centres it in the space the avatar and the
          right cluster leave. shrink-0 so the team names are never squeezed to
          nothing (the old min-w-0 + max-w-[40%] collapsed the label, leaving a
          bare "< • •" on the narrow screen). Links back to the lobby. */}
      <Link
        href="/"
        onClick={() => playSound("navTap")}
        className="mx-auto flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 shadow-soft transition-[transform,border-color] hover:border-line2 active:scale-[0.97]"
      >
        <ChevronLeft size={14} className="shrink-0 text-mut" />
        <Flag abbr={fixture.home.abbr} color={fixture.home.color} />
        <span className="truncate text-[13px] font-semibold text-ink">
          {fixture.home.abbr} <span className="text-faint">·</span> {fixture.away.abbr}
        </span>
        <Flag abbr={fixture.away.abbr} color={fixture.away.color} />
        {live && <span className="ml-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red animate-pulse2" />}
      </Link>

      <div className="flex shrink-0 items-center gap-1.5">
        {/* Your live $PROOF: the one playable balance, always on screen so you
            watch it move on every call (ticks up on a win, down on a wrong call). */}
        {user && <CoinBalance coins={coins} />}
        <MuteButton className="h-9 w-9" />
        <ThemeToggle className="h-9 w-9" />
      </div>
    </m.div>
  );
}

// The running balance, count-up animated so a settle visibly ticks the number
// rather than snapping. Same spring approach as the Earn balance hero.
function CoinBalance({ coins }: { coins: number }) {
  const reduce = useReducedMotion();
  const spring = useSpring(coins, springSoft);
  const [display, setDisplay] = useState(coins);
  useEffect(() => {
    if (reduce) {
      spring.jump(coins);
      setDisplay(coins);
    } else {
      spring.set(coins);
    }
  }, [coins, reduce, spring]);
  useMotionValueEvent(spring, "change", (v) => setDisplay(Math.round(v)));

  return (
    <div
      title="Your $PROOF"
      className="flex h-8 shrink-0 items-center gap-1 rounded-full border border-line bg-surface px-2.5 shadow-soft"
    >
      <img src="/proof-mark.png" alt="$PROOF" className="h-auto w-[18px] shrink-0" />
      <span className="tabular-nums text-[13px] font-bold text-ink">{display.toLocaleString()}</span>
    </div>
  );
}
