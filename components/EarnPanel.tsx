"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValueEvent, useReducedMotion, useSpring } from "framer-motion";
import { useStore } from "@/lib/store";
import { DUR, EASE_INOUT, EASE_OUT, listContainer, listItem, springSoft } from "@/lib/motion";
import CoinBurst from "@/components/fx/CoinBurst";
import CountUp from "@/components/fx/CountUp";
import { Coin, Flame, Bullseye, Trophy, ShieldCheck } from "./Icons";

export default function EarnPanel() {
  const proof = useStore((s) => s.proof);
  const refreshProof = useStore((s) => s.refreshProof);
  const streak = useStore((s) => s.streak);
  const best = useStore((s) => s.best);
  const board = useStore((s) => s.leaderboard);
  const rank = Math.max(1, board.findIndex((r) => r.you) + 1);
  const nextReward = 50 + Math.min(streak, 6) * 15;
  const reduce = useReducedMotion();

  // Fire a small coin burst on the balance the moment a WIN settles while the
  // Earn tab is mounted. `lastResult.n` bumps once per settlement; we replay the
  // burst only when that token advances (not on mount for a pre-existing win)
  // and only for wins.
  const lastResult = useStore((s) => s.lastResult);
  const [burstKey, setBurstKey] = useState(0);
  const seenN = useRef(lastResult?.n ?? null);
  useEffect(() => {
    const n = lastResult?.n ?? null;
    if (n === null || n === seenN.current) return;
    seenN.current = n;
    if (lastResult?.outcome === "won") setBurstKey((k) => k + 1);
  }, [lastResult]);

  // The balance is the wallet's real on-chain $PROOF (same source as the Profile
  // card and the wallet itself), NOT the internal game-points field. Refresh it
  // when the Earn tab opens so it matches the chain.
  useEffect(() => {
    void refreshProof();
  }, [refreshProof]);

  // Smoothly count the balance to its new value when it changes mid-mount.
  const proofSpring = useSpring(proof, springSoft);
  const [proofDisplay, setProofDisplay] = useState(proof);
  useEffect(() => {
    if (reduce) {
      proofSpring.jump(proof);
      setProofDisplay(proof);
    } else {
      proofSpring.set(proof);
    }
  }, [proof, reduce, proofSpring]);
  useMotionValueEvent(proofSpring, "change", (v) => setProofDisplay(Math.round(v)));

  return (
    <motion.div
      className="flex flex-col gap-4 px-4"
      variants={reduce ? undefined : listContainer}
      initial={reduce ? false : "hidden"}
      animate="show"
    >
      {/* balance hero */}
      <motion.div variants={reduce ? undefined : listItem} className="relative rounded-[24px] border border-line bg-surface p-5 shadow-card">
        <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-mut">Your $PROOF</div>
        <div className="relative mt-1 flex items-end gap-2">
          <span className="text-[clamp(38px,11vw,52px)] font-extrabold leading-none tracking-[-0.03em] text-ink tabular-nums">
            {proofDisplay.toLocaleString()}
          </span>
          <span className="mb-1.5 flex items-center gap-1 text-[16px] font-semibold text-mut">
            <Coin size={17} className="text-amber" /> $PROOF
          </span>
          {/* reward flourish: coins spray from the balance on a won call */}
          <CoinBurst fireKey={burstKey} count={6} size={12} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <Metric icon={<Flame size={19} strokeWidth={2.25} />} label="Streak" value={`${streak}`} tint="orange" heat={streak} />
          <Metric
            icon={<Bullseye size={19} strokeWidth={2.1} />}
            label="Multiplier"
            value={<CountUp value={nextReward / 50} format={(v) => v.toFixed(1)} suffix="×" />}
            tint="grn"
          />
          <Metric icon={<Trophy size={19} strokeWidth={2.25} />} label="Rank" value={`#${rank}`} tint="violet" />
        </div>
      </motion.div>

      {/* how you earn */}
      <motion.div variants={reduce ? undefined : listItem} className="rounded-[24px] border border-line bg-surface p-5 shadow-soft">
        <div className="text-[15px] font-semibold text-ink">How you earn</div>
        <div className="mt-4 flex flex-col gap-4">
          <Step
            n={1}
            icon={<Bullseye size={18} />}
            title="Call it right"
            body={`Predict which way the live win-probability moves. A correct call pays +50 $PROOF.`}
          />
          <Step
            n={2}
            icon={<Flame size={18} />}
            title="Build a streak"
            body="Each call in a row raises your multiplier, up to 2.8× per correct call. Miss one and it resets."
          />
          <Step
            n={3}
            icon={<Trophy size={18} />}
            title="Top the leaderboard"
            body="The top of the weekly friends leaderboard splits the prize pool. Bragging rights included."
          />
        </div>
      </motion.div>

      {/* fairness / model note */}
      <motion.div variants={reduce ? undefined : listItem} className="flex items-start gap-3 rounded-[20px] border border-line bg-subtle p-4">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-grn" />
        <p className="text-[12.5px] leading-[1.55] text-ink2">
          <b className="text-ink">Free to play, provably fair.</b> $PROOF costs nothing, every settlement is
          verified against on-chain World Cup data. Prize pools run on a small rake; premium unlocks extra
          markets.
        </p>
      </motion.div>
    </motion.div>
  );
}

// Streak flame heat ramp: a cool ember at streak 0 warms to a hot amber/orange
// at the reward cap (streak 6). RGB-lerped so the glyph reads as literally
// heating up beside its rising multiplier.
const FLAME_COOL = [122, 148, 178] as const; // cool slate — no fire yet
const FLAME_HOT = [255, 118, 22] as const; // hot orange at the cap
function mixRgb(a: readonly [number, number, number], b: readonly [number, number, number], t: number) {
  const c = (i: number) => Math.round(a[i] + (b[i] - a[i]) * t);
  return `rgb(${c(0)}, ${c(1)}, ${c(2)})`;
}
const STREAK_CAP = 6;

function Metric({
  icon,
  label,
  value,
  tint,
  heat,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tint: "orange" | "grn" | "violet";
  /** Streak count. When set (Streak tile only), the flame heats + breathes toward the cap. */
  heat?: number;
}) {
  // Each icon sits in its own tinted tile, the same icon-in-a-tile motif as the
  // $PROOF balance card, so the metrics read as a deliberate set, not loose glyphs.
  // Streak burns orange, multiplier locks on green, rank shines violet.
  const reduce = useReducedMotion();
  const chip = {
    orange: "bg-orange/[0.12] text-orange",
    grn: "bg-grn/[0.12] text-grn",
    violet: "bg-violet/[0.12] text-violet",
  }[tint];

  // Only the Streak tile passes `heat`. `t` is the climb toward the cap (0→1):
  // it drives the flame's colour + a colour-matched glow, and at streak ≥ 3 a
  // slow breathing pulse. Reduced motion keeps the hot colour + glow, drops the
  // pulse.
  const hot = heat != null;
  const t = hot ? Math.min(Math.max(heat, 0), STREAK_CAP) / STREAK_CAP : 0;
  const flameColor = hot ? mixRgb(FLAME_COOL, FLAME_HOT, t) : undefined;
  const glow =
    hot && t > 0.02
      ? `drop-shadow(0 0 ${(3 + t * 9).toFixed(1)}px rgba(255, 122, 26, ${(t * 0.55).toFixed(2)}))`
      : undefined;
  const breathing = hot && heat >= 3 && !reduce;

  return (
    <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-subtle px-2 py-3.5">
      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${chip}`}>
        {hot ? (
          <motion.span
            className="flex items-center justify-center will-change-transform"
            style={{ color: flameColor, filter: glow }}
            animate={breathing ? { scale: [1, 1.06, 1] } : { scale: 1 }}
            transition={
              breathing
                ? { duration: 1.4, ease: EASE_INOUT, repeat: Infinity }
                : { duration: DUR.base, ease: EASE_OUT }
            }
          >
            {icon}
          </motion.span>
        ) : (
          icon
        )}
      </span>
      <span className="tabular-nums text-[19px] font-bold leading-none text-ink">{value}</span>
      <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-mut">{label}</span>
    </div>
  );
}

function Step({
  n,
  icon,
  title,
  body,
}: {
  n: number;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-3.5">
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-subtle text-ink">
        {icon}
        <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[11px] font-bold text-bg">
          {n}
        </span>
      </div>
      <div className="min-w-0">
        <div className="text-[14px] font-semibold text-ink">{title}</div>
        <div className="mt-0.5 text-[12.5px] leading-[1.5] text-ink2">{body}</div>
      </div>
    </div>
  );
}
