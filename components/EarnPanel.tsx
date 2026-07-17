"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValueEvent, useReducedMotion, useSpring } from "framer-motion";
import { useStore } from "@/lib/store";
import { listContainer, listItem, springSoft } from "@/lib/motion";
import { Coin, Flame, Target, Trophy, ShieldCheck } from "./Icons";

export default function EarnPanel() {
  const proof = useStore((s) => s.proof);
  const refreshProof = useStore((s) => s.refreshProof);
  const streak = useStore((s) => s.streak);
  const best = useStore((s) => s.best);
  const board = useStore((s) => s.leaderboard);
  const rank = Math.max(1, board.findIndex((r) => r.you) + 1);
  const nextReward = 50 + Math.min(streak, 6) * 15;
  const multiplier = (nextReward / 50).toFixed(1);
  const reduce = useReducedMotion();

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
      <motion.div variants={reduce ? undefined : listItem} className="rounded-[24px] border border-line bg-surface p-5 shadow-card">
        <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-mut">Your $PROOF</div>
        <div className="mt-1 flex items-end gap-2">
          <span className="text-[clamp(38px,11vw,52px)] font-extrabold leading-none tracking-[-0.03em] text-ink tabular-nums">
            {proofDisplay.toLocaleString()}
          </span>
          <span className="mb-1.5 flex items-center gap-1 text-[16px] font-semibold text-mut">
            <Coin size={17} className="text-amber" /> $PROOF
          </span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <Metric icon={<Flame size={16} />} label="Streak" value={`${streak}`} tint="amber" />
          <Metric icon={<Target size={16} />} label="Multiplier" value={`${multiplier}×`} tint="grn" />
          <Metric icon={<Trophy size={16} />} label="Rank" value={`#${rank}`} tint="ink" />
        </div>
      </motion.div>

      {/* how you earn */}
      <motion.div variants={reduce ? undefined : listItem} className="rounded-[24px] border border-line bg-surface p-5 shadow-soft">
        <div className="text-[15px] font-semibold text-ink">How you earn</div>
        <div className="mt-4 flex flex-col gap-4">
          <Step
            n={1}
            icon={<Target size={18} />}
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

function Metric({
  icon,
  label,
  value,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tint: "amber" | "grn" | "ink";
}) {
  // Each icon sits in its own tinted tile, the same icon-in-a-tile motif as the
  // $PROOF balance card, so the metrics read as a deliberate set, not loose glyphs.
  const chip = {
    amber: "bg-amber/10 text-amber",
    grn: "bg-grn/10 text-grn",
    ink: "bg-ink/[0.06] text-ink",
  }[tint];
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-subtle px-2 py-3.5">
      <span className={`flex h-8 w-8 items-center justify-center rounded-[11px] ${chip}`}>{icon}</span>
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
