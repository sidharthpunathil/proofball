"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useStore } from "@/lib/store";
import { EASE_OUT, springSnappy, tweenFast } from "@/lib/motion";
import { ArrowUpRight, ArrowDownRight, Broadcast, Coin, ExternalLink } from "./Icons";

/**
 * The signature action: a glossy black pill split into Rising / Falling with a
 * floating disc in the middle (countdown / state). This is where a user calls
 * the live win-probability · and where they earn.
 */
export default function PredictControl() {
  const current = useStore((s) => s.current);
  const setPick = useStore((s) => s.setPick);
  const streak = useStore((s) => s.streak);
  const [now, setNow] = useState(() => Date.now());
  const reduce = useReducedMotion();

  // A per-tap flash token. Bumps on every pick (even re-picking the same side),
  // so the arrow launch + disc ring replay each time. n keys the animations.
  const [flash, setFlash] = useState<{ dir: "up" | "down"; n: number } | null>(null);
  const pick = (dir: "up" | "down") => {
    setPick(dir);
    setFlash((f) => ({ dir, n: (f?.n ?? 0) + 1 }));
  };

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(iv);
  }, []);

  const nextReward = 50 + Math.min(streak, 6) * 15;
  const open = current?.status === "open";
  const locked = current?.status === "locked";
  const secs = current ? Math.max(0, Math.ceil((current.lockAt - now) / 1000)) : 0;
  // One key per disc state (not per countdown tick), so the inner content only
  // re-mounts + settles when the market itself changes phase, never each second.
  const discState = open ? "count" : locked ? "lock" : "idle";

  return (
    <div className="px-4">
      {/* label row */}
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-ink">
          <Broadcast size={14} className="text-grn" />
          {locked ? "Pick locked" : open ? "Live call" : "Next call"}
        </span>
        <span className="text-[12px] font-medium text-mut">
          {open ? `locks in ${secs}s` : locked ? "settling…" : "loading…"}
        </span>
      </div>

      {/* the black pill */}
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
          {/* one-shot colored ring that bursts out of the disc on each pick */}
          <AnimatePresence>
            {flash && !reduce && (
              <motion.span
                key={flash.n}
                initial={{ scale: 0.7, opacity: 0.8 }}
                animate={{ scale: 2.3, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: EASE_OUT }}
                className="pointer-events-none absolute inset-0 rounded-full border-2"
                style={{ borderColor: `rgb(var(--${flash.dir === "up" ? "grn" : "red"}))` }}
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
                transition={reduce ? tweenFast : springSnappy}
                className="flex items-center justify-center"
              >
                {open ? (
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

      {/* earn hint / verify */}
      {locked && current?.memoSig ? (
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
