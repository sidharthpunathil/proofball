"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useStore } from "@/lib/store";
import { EASE_OUT, springPop, springSnappy, tweenFast } from "@/lib/motion";
import { ArrowUpRight, ArrowDownRight, Broadcast, Check, Close, Coin, ExternalLink, Flame } from "./Icons";
import { playSound } from "@/lib/sound";
import CoinBurst from "@/components/fx/CoinBurst";
import CountUp from "@/components/fx/CountUp";

/**
 * The signature action: a glossy black pill split into Rising / Falling with a
 * floating disc in the middle (countdown / state). This is where a user calls
 * the live win-probability · and where they earn.
 */
export default function PredictControl() {
  const current = useStore((s) => s.current);
  const setPick = useStore((s) => s.setPick);
  const streak = useStore((s) => s.streak);
  const lastResult = useStore((s) => s.lastResult);
  const [now, setNow] = useState(() => Date.now());
  const reduce = useReducedMotion();

  // A per-tap flash token. Bumps on every pick (even re-picking the same side),
  // so the arrow launch replays each time. n keys the arrow animations.
  const [flash, setFlash] = useState<{ dir: "up" | "down"; n: number } | null>(null);
  // The one-shot ring that bursts out of the disc — fired on each pick (tinted
  // by direction) and re-fired green on a won settlement.
  const [ring, setRing] = useState<{ n: number; color: string } | null>(null);
  // A per-win token that replays the coin spray over the disc.
  const [burst, setBurst] = useState(0);
  // The just-settled outcome, held ~1600ms so win/loss is legible in the disc.
  const [result, setResult] = useState<{ outcome: "won" | "lost"; reward: number } | null>(null);

  const pick = (dir: "up" | "down") => {
    setPick(dir);
    playSound(dir === "up" ? "pickUp" : "pickDown");
    setFlash((f) => ({ dir, n: (f?.n ?? 0) + 1 }));
    setRing((r) => ({ n: (r?.n ?? 0) + 1, color: dir === "up" ? "grn" : "red" }));
  };

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(iv);
  }, []);

  const nextReward = 50 + Math.min(streak, 6) * 15;
  const open = current?.status === "open";
  const locked = current?.status === "locked";
  const secs = current ? Math.max(0, Math.ceil((current.lockAt - now) / 1000)) : 0;

  // Final-3s urgency: one dry tick on each of secs 3 / 2 / 1, climbing in pitch.
  // The 100ms `now` interval re-renders ~10×/s, so a ref gates the tick to fire
  // exactly once per whole second (and re-arms once we leave the 3s window).
  const tickRef = useRef(0);
  useEffect(() => {
    if (open && secs >= 1 && secs <= 3) {
      if (tickRef.current !== secs) {
        tickRef.current = secs;
        playSound("tickWarn", { level: 3 - secs });
      }
    } else {
      tickRef.current = 0;
    }
  }, [open, secs]);

  // Settlement edge: when lastResult.n bumps, hold the outcome for the disc +
  // hint, and (on a win) spray coins and re-fire the ring green. Sound is the
  // global SoundLayer's job — we never play win/lose/coin here.
  const prevNRef = useRef(lastResult?.n ?? 0);
  useEffect(() => {
    if (!lastResult || lastResult.n === prevNRef.current) return;
    prevNRef.current = lastResult.n;
    setResult({ outcome: lastResult.outcome, reward: lastResult.reward });
    if (lastResult.outcome === "won") {
      setBurst((b) => b + 1);
      setRing((r) => ({ n: (r?.n ?? 0) + 1, color: "grn" }));
    }
    const t = setTimeout(() => setResult(null), 1600);
    return () => clearTimeout(t);
  }, [lastResult]);

  // The disc shows the held outcome while a result is on-screen, otherwise the
  // live countdown / settling / idle state. One key per state (not per tick),
  // so the inner content only re-mounts when the disc's meaning changes.
  const discState = result
    ? result.outcome === "won"
      ? "win"
      : "loss"
    : open
      ? "count"
      : locked
        ? "lock"
        : "idle";

  return (
    <div className="px-4">
      {/* label row */}
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-ink">
          <Broadcast size={14} className="text-grn" />
          {locked ? "Pick locked" : open ? "Live call" : "Next call"}
          {/* streak combo badge — pops in at 3+ and re-pops each tier climb */}
          <AnimatePresence>
            {streak >= 3 && (
              <motion.span
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, transition: tweenFast }}
                transition={reduce ? tweenFast : springPop}
                className="inline-flex items-center gap-0.5 rounded-full bg-amber/15 px-1.5 py-[3px] text-[10px] font-bold leading-none text-amber"
              >
                <motion.span
                  key={streak}
                  initial={reduce ? false : { scale: 0.7 }}
                  animate={reduce ? {} : { scale: 1 }}
                  transition={springPop}
                  className="inline-flex items-center gap-0.5"
                >
                  <Flame size={11} />×{streak}
                </motion.span>
              </motion.span>
            )}
          </AnimatePresence>
        </span>
        <span className="text-[12px] font-medium text-mut">
          {open ? `locks in ${secs}s` : locked ? "settling…" : "loading…"}
        </span>
      </div>

      {/* the black pill — wrapped in a relative host so the won-call coin spray
          can fan up over the disc without the pill's rounded clip cropping it */}
      <div className="relative">
        <div
          className={`relative flex h-16 items-stretch overflow-hidden rounded-full bg-ink text-bg shadow-btn transition-opacity ${
            current ? "opacity-100" : "opacity-60"
          }`}
        >
          <Half
            side="up"
            label="Rising"
            chosen={current?.dir === "up"}
            disabled={!open}
            flashN={flash?.dir === "up" ? flash.n : 0}
            onClick={() => pick("up")}
          />
          <Half
            side="down"
            label="Falling"
            chosen={current?.dir === "down"}
            disabled={!open}
            flashN={flash?.dir === "down" ? flash.n : 0}
            onClick={() => pick("down")}
          />

          {/* floating center disc */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-ink">
            {/* one-shot colored ring that bursts out of the disc — on each pick
                (tinted by direction) and re-fired green when a call is won */}
            <AnimatePresence>
              {ring && !reduce && (
                <motion.span
                  key={ring.n}
                  initial={{ scale: 0.7, opacity: 0.8 }}
                  animate={{ scale: 2.3, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6, ease: EASE_OUT }}
                  className="pointer-events-none absolute inset-0 rounded-full border-2"
                  style={{ borderColor: `rgb(var(--${ring.color}))` }}
                />
              )}
            </AnimatePresence>
            <span className="disc relative flex h-full w-full items-center justify-center rounded-full">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={discState}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reduce ? { opacity: 0, transition: tweenFast } : { opacity: 0, scale: 0.8, transition: tweenFast }}
                  transition={reduce ? tweenFast : discState === "win" ? springPop : springSnappy}
                  className="flex items-center justify-center"
                >
                  {discState === "win" ? (
                    <Check size={20} className="text-grn" />
                  ) : discState === "loss" ? (
                    <Close size={20} className="text-red" />
                  ) : open ? (
                    <span className="tabular-nums text-[16px] font-bold text-[#1a1a1f]">{secs}</span>
                  ) : locked ? (
                    <span className="h-2.5 w-2.5 rounded-full bg-[#1a1a1f] animate-pulse2" />
                  ) : (
                    <Broadcast size={16} className="text-[#1a1a1f]" />
                  )}
                </motion.span>
              </AnimatePresence>
            </span>
          </div>
        </div>
        {/* reward spray fans from the disc center, above the pill's rounded clip
            (self-disables under reduced motion) */}
        <CoinBurst fireKey={burst} count={5} size={11} />
      </div>

      {/* earn hint / verify */}
      {result ? (
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={tweenFast}
          className="mt-2.5 flex items-center justify-center gap-1.5 text-[12px] font-semibold"
        >
          {result.outcome === "won" ? (
            <>
              <motion.span
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={reduce ? tweenFast : springPop}
                className="inline-flex"
              >
                <Coin size={13} className="text-amber" />
              </motion.span>
              <CountUp value={result.reward} prefix="+" suffix=" $PROOF" className="tabular-nums text-grn" />
            </>
          ) : (
            <span className="text-mut">Not this time</span>
          )}
        </motion.div>
      ) : locked && current?.memoSig ? (
        <motion.a
          href={current.verifyUrl}
          target="_blank"
          rel="noreferrer"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={tweenFast}
          className="mt-2.5 flex items-center justify-center gap-1.5 text-[12px] font-medium text-ink2 hover:text-ink"
        >
          <ExternalLink size={13} /> Committed on-chain · verify on Solana
        </motion.a>
      ) : (
        <div className="mt-2.5 flex items-center justify-center gap-1.5 text-[12px] font-medium text-mut">
          <Coin size={13} className="text-amber" />
          {locked
            ? `Locked at ${current?.lockedProb?.toFixed(0)}%`
            : open
              ? `Call it right to earn +${nextReward} $PROOF`
              : `Reading the market…`}
        </div>
      )}
    </div>
  );
}

function Half({
  side,
  label,
  chosen,
  disabled,
  flashN,
  onClick,
}: {
  side: "up" | "down";
  label: string;
  chosen?: boolean;
  disabled?: boolean;
  /** Bumps each time THIS side is picked; 0 when it isn't the active pick. */
  flashN: number;
  onClick: () => void;
}) {
  const isUp = side === "up";
  const reduce = useReducedMotion();
  const Arrow = isUp ? ArrowUpRight : ArrowDownRight;
  const dirY = isUp ? -7 : 7;

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.93 }}
      animate={chosen ? { scale: 1.04 } : { scale: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      className={`relative flex flex-1 items-center gap-1.5 overflow-hidden px-6 transition-opacity disabled:cursor-default ${
        isUp ? "justify-start" : "justify-end"
      } ${chosen ? "opacity-100" : "opacity-80"}`}
    >
      {/* directional colored wash that floods the chosen side */}
      <AnimatePresence>
        {chosen && (
          <motion.span
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.15 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, transition: tweenFast }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
            className="pointer-events-none absolute inset-0"
            style={{
              background: isUp
                ? "radial-gradient(120% 130% at 0% 55%, rgb(var(--grn) / 0.28), transparent 68%)"
                : "radial-gradient(120% 130% at 100% 55%, rgb(var(--red) / 0.28), transparent 68%)",
            }}
          />
        )}
      </AnimatePresence>

      {isUp && (
        <motion.span
          key={flashN}
          initial={flashN ? { y: 0, scale: 1 } : false}
          animate={reduce ? {} : flashN ? { y: [0, dirY, 0], scale: [1, 1.35, 1] } : { scale: 1 }}
          transition={{ duration: 0.42, ease: EASE_OUT }}
          className="relative"
        >
          <Arrow size={18} className={chosen ? "text-grn" : "text-bg"} />
        </motion.span>
      )}
      <span className={`relative text-[15px] font-semibold ${chosen ? (isUp ? "text-grn" : "text-red") : "text-bg"}`}>
        {label}
      </span>
      {!isUp && (
        <motion.span
          key={flashN}
          initial={flashN ? { y: 0, scale: 1 } : false}
          animate={reduce ? {} : flashN ? { y: [0, dirY, 0], scale: [1, 1.35, 1] } : { scale: 1 }}
          transition={{ duration: 0.42, ease: EASE_OUT }}
          className="relative"
        >
          <Arrow size={18} className={chosen ? "text-red" : "text-bg"} />
        </motion.span>
      )}
    </motion.button>
  );
}
