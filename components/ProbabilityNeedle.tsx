"use client";

import { useEffect, useRef, useState } from "react";
import { m, useMotionValueEvent, useReducedMotion, useSpring } from "framer-motion";
import { ArrowUp, ArrowDown } from "./Icons";
import Flag from "./Flag";
import { EASE_OUT, DUR, springPop } from "@/lib/motion";

interface Props {
  homeProb: number;
  drawProb: number;
  awayProb: number;
  home: string;
  away: string;
  homeColor: string;
  awayColor: string;
  flashKey: number;
}

const CX = 150;
const CY = 150;
const R = 132;
const TRACK = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;

function tip(p: number) {
  const angle = (180 - 1.8 * p) * (Math.PI / 180);
  return { x: CX + R * Math.cos(angle), y: CY - R * Math.sin(angle) };
}

export default function ProbabilityNeedle({
  homeProb,
  drawProb,
  awayProb,
  home,
  away,
  homeColor,
  awayColor,
  flashKey,
}: Props) {
  const p = Math.max(0, Math.min(100, homeProb));
  const t = tip(p);
  const reduce = useReducedMotion();

  const prev = useRef(p);
  const [dir, setDir] = useState<"up" | "down" | "flat">("flat");
  useEffect(() => {
    const d = p - prev.current;
    if (Math.abs(d) > 0.15) setDir(d > 0 ? "up" : "down");
    prev.current = p;
  }, [p]);

  // Smoothly count the big win-probability number to its new value.
  const spring = useSpring(p, { stiffness: 200, damping: 25 });
  const [display, setDisplay] = useState(Math.round(p));
  useEffect(() => {
    if (reduce) {
      spring.jump(p);
      setDisplay(Math.round(p));
    } else {
      spring.set(p);
    }
  }, [p, reduce, spring]);
  useMotionValueEvent(spring, "change", (v) => setDisplay(Math.round(v)));

  return (
    <div className="relative w-full select-none">
      <div
        key={flashKey}
        className={`pointer-events-none absolute inset-0 rounded-[28px] ${
          dir === "down" ? "animate-flashDown" : "animate-flash"
        }`}
      />
      <svg viewBox="0 0 300 172" className="w-full overflow-visible">
        <path d={TRACK} fill="none" className="stroke-line2" strokeWidth={14} strokeLinecap="round" />
        <path
          d={TRACK}
          fill="none"
          className="stroke-grn"
          strokeWidth={14}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${p} 100`}
          style={{ transition: reduce ? "none" : "stroke-dasharray 0.7s cubic-bezier(0.16,1,0.3,1)" }}
        />
        <m.g
          animate={{ x: t.x, y: t.y }}
          transition={reduce ? { duration: 0 } : { duration: 0.7, ease: EASE_OUT }}
        >
          {/* One-shot goal halo: fires only on a big event (flashKey), never on routine ticks. */}
          <m.circle
            key={flashKey}
            r={8}
            className={dir === "down" ? "fill-red" : "fill-grn"}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
            initial={{ opacity: 0.4, scale: 1 }}
            animate={reduce ? { opacity: 0 } : { opacity: 0, scale: 2.6 }}
            transition={{ duration: DUR.slow, ease: EASE_OUT }}
          />
          {/* Knob: pops on a big event, otherwise rides the arc tip on the same curve as the fill. */}
          <m.circle
            key={`knob-${flashKey}`}
            r={8}
            className="fill-bg stroke-grn"
            strokeWidth={3}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
            // Pop then settle. A spring only allows two keyframes, so we start
            // popped (1.35) and let springPop settle it to 1; the key remount on
            // flashKey re-fires the pop for each goal/red card.
            initial={reduce ? { scale: 1 } : { scale: 1.35 }}
            animate={{ scale: 1 }}
            transition={reduce ? { duration: 0 } : springPop}
          />
        </m.g>

        <text
          x={CX}
          y={126}
          textAnchor="middle"
          className="fill-ink"
          style={{ fontSize: 54, fontWeight: 800, letterSpacing: "-2px" }}
        >
          {display}
          <tspan className="fill-mut" style={{ fontSize: 22, fontWeight: 600 }}>
            %
          </tspan>
        </text>
        <text
          x={CX}
          y={150}
          textAnchor="middle"
          className="fill-mut"
          style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.4px" }}
        >
          {home.toUpperCase()} TO WIN
        </text>
      </svg>

      <div className="mt-1 flex items-center justify-between px-1 text-[13px] font-semibold">
        <div className="flex items-center gap-1.5">
          <Flag abbr={away} color={awayColor} />
          <span className="text-mut">{away}</span>
          <span className="tabular-nums text-ink">{awayProb.toFixed(0)}%</span>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] text-mut">
          <span>Draw</span>
          <span className="tabular-nums text-ink">{drawProb.toFixed(0)}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="tabular-nums text-ink">{homeProb.toFixed(0)}%</span>
          <span className="text-mut">{home}</span>
          <Flag abbr={home} color={homeColor} />
          {dir === "up" && <ArrowUp size={14} className="text-grn" />}
          {dir === "down" && <ArrowDown size={14} className="text-red" />}
        </div>
      </div>
    </div>
  );
}
