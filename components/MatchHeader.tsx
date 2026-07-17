"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useStore } from "@/lib/store";
import { useFixture } from "@/lib/fixture-context";
import { DUR, EASE_BACK, tweenBase, tweenFast } from "@/lib/motion";
import { Clock, Play } from "./Icons";

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

/**
 * Time left until kick-off, coarsened by how far away it is: days out show
 * "2d 5h", within a day "5h 12m", and inside the last hour a ticking "12:34"
 * so the final stretch feels live. Never renders negative values.
 */
function formatCountdown(ms: number): string {
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const mins = Math.floor((total % 3_600) / 60);
  const secs = total % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

/**
 * Live "starts in …" clock for an upcoming fixture, with the absolute UTC
 * kick-off time trailing as context. `now` starts null so the server and the
 * first client render agree (no Date.now hydration mismatch); the tick begins
 * on mount. Once kick-off passes it holds at "Kick-off imminent" until the
 * feed flips the fixture to live.
 */
function Countdown({ startTime }: { startTime: number }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  const remaining = now == null || !startTime ? null : startTime - now;

  return (
    <>
      <Clock size={11} className="text-ink2" />
      <span className="text-ink2 tabular-nums">
        {remaining == null
          ? "Starts soon"
          : remaining <= 0
            ? "Kick-off imminent"
            : `Starts in ${formatCountdown(remaining)}`}
      </span>
      <span className="text-faint">·</span>
      <span className="text-faint">{kickoff(startTime)}</span>
    </>
  );
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
          <Countdown startTime={fixture.startTime} />
        ) : finished ? (
          <>
            <Play size={11} className="text-ink2" />
            <span className="text-ink2">Replay</span>
            <span className="text-faint">·</span>
            {/* keyed on phase, so the live minute updates silently and only the
                phase flip (→ FT) animates, with a small overshoot at full-time */}
            <PhaseTag phase={phase} reduce={!!reduce}>
              {phase === "FT" ? "Full-time" : `${minute}'`}
            </PhaseTag>
          </>
        ) : (
          <>
            <span className={live ? "text-red" : ""}>{live ? `${minute}'` : PHASE_LABEL[phase]}</span>
            <span className="text-faint">·</span>
            <PhaseTag phase={phase} reduce={!!reduce}>
              {PHASE_LABEL[phase]}
            </PhaseTag>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * The trailing phase/status word (Pre-match → 1st Half → … → Full-time).
 * Crossfades + rises on each phase change instead of hard-swapping; keyed on
 * the phase, never the minute, so the live clock updates without re-animating.
 * Full-time enters with a touch of overshoot as a small end-of-match beat.
 * Reduced motion degrades to a plain opacity crossfade.
 */
function PhaseTag({ phase, reduce, children }: { phase: string; reduce: boolean; children: ReactNode }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={phase}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, transition: tweenFast }}
        transition={reduce ? tweenFast : phase === "FT" ? { duration: DUR.fast, ease: EASE_BACK } : tweenFast}
        className="inline-block"
      >
        {children}
      </motion.span>
    </AnimatePresence>
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
