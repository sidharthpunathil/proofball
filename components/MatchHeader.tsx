"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useStore } from "@/lib/store";
import { useFixture } from "@/lib/fixture-context";
import { tweenBase } from "@/lib/motion";
import { Play } from "./Icons";

const PHASE_LABEL: Record<string, string> = {
  PRE: "Pre-match",
  H1: "1st Half",
  HT: "Half-time",
  H2: "2nd Half",
  FT: "Full-time",
};

function kickoff(ts: number): string {
  if (!ts) return "Kick-off soon";
  const d = new Date(ts);
  const day = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return `${day} · ${time} UTC`;
}

export default function MatchHeader() {
  const fixture = useFixture();
  const scoreH = useStore((s) => s.scoreH);
  const scoreA = useStore((s) => s.scoreA);
  const minute = useStore((s) => s.minute);
  const phase = useStore((s) => s.phase);
  const connected = useStore((s) => s.connected);
  const finished = fixture.status === "finished";
  // A finished match only ever plays back, so it is never treated as live.
  const live = !finished && phase !== "FT" && phase !== "PRE";
  const upcoming = fixture.status === "upcoming";
  const reduce = useReducedMotion();

  return (
    <div className="px-4 pt-4 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-mut">
        {fixture.competition} · {fixture.round}
      </div>
      <div className="mt-2 flex items-center justify-center gap-4">
        <Team name={fixture.home.abbr} color={fixture.home.color} align="right" />
        <div className="flex items-baseline gap-2 tabular-nums text-ink">
          <Score value={scoreH} reduce={!!reduce} />
          <span className="text-[20px] font-semibold text-faint">:</span>
          <Score value={scoreA} reduce={!!reduce} />
        </div>
        <Team name={fixture.away.abbr} color={fixture.away.color} align="left" />
      </div>
      <div className="mt-2 flex items-center justify-center gap-2 text-[12px] font-medium text-mut">
        {live && (
          <motion.span
            className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-red animate-pulse2" : "bg-mut"}`}
            animate={{ opacity: connected ? 1 : 0.55 }}
            transition={reduce ? { duration: 0 } : tweenBase}
          />
        )}
        {upcoming ? (
          <span className="text-ink2">{kickoff(fixture.startTime)}</span>
        ) : finished ? (
          <>
            <Play size={11} className="text-ink2" />
            <span className="text-ink2">Replay</span>
            <span className="text-faint">·</span>
            <span>{phase === "FT" ? "Full-time" : `${minute}'`}</span>
          </>
        ) : (
          <>
            <span className={live ? "text-red" : ""}>{live ? `${minute}'` : PHASE_LABEL[phase]}</span>
            <span className="text-faint">·</span>
            <span>{PHASE_LABEL[phase]}</span>
          </>
        )}
      </div>
    </div>
  );
}

function Score({ value, reduce }: { value: number; reduce: boolean }) {
  return (
    <span className="relative inline-block text-[38px] font-bold leading-none">
      <motion.span
        key={value}
        initial={reduce ? false : { scale: 1.6, opacity: 0, y: -4 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 20 }}
        className="inline-block"
      >
        {value}
      </motion.span>
    </span>
  );
}

function Team({ name, color, align }: { name: string; color: string; align: "left" | "right" }) {
  return (
    <div className={`flex items-center gap-2 ${align === "left" ? "flex-row" : "flex-row-reverse"}`}>
      <span className="h-3 w-3 rounded-full" style={{ background: color }} />
      <span className="text-[17px] font-bold tracking-tight text-ink">{name}</span>
    </div>
  );
}
