"use client";

import { useEffect } from "react";
import { motion, useReducedMotion, useSpring } from "framer-motion";
import { EASE_OUT, DUR, springSoft } from "@/lib/motion";

interface Props {
  data: number[];
}

export default function Sparkline({ data }: Props) {
  const reduce = useReducedMotion();
  const w = 300;
  const h = 40;

  // Compute the current-value dot position (safe when data is short) so hooks
  // below run unconditionally before the early return.
  const min = Math.min(...data, 30);
  const max = Math.max(...data, 70);
  const span = max - min || 1;
  const last = data.length ? data[data.length - 1] : min;
  const lastY = h - ((last - min) / span) * (h - 6) - 3;

  // Glide only the end dot to each new value. The polyline geometry stays
  // non-animated on purpose: morphing the whole path per tick reads as jitter.
  const cy = useSpring(lastY, springSoft);
  useEffect(() => {
    if (reduce) cy.jump(lastY);
    else cy.set(lastY);
  }, [lastY, reduce, cy]);

  if (data.length < 2) return <div className="h-[40px] w-full" aria-hidden />;

  const step = w / (data.length - 1);
  const pts = data.map((val, i) => {
    const x = i * step;
    const y = h - ((val - min) / span) * (h - 6) - 3;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full text-grn" preserveAspectRatio="none">
      <polygon points={`0,${h} ${pts.join(" ")} ${w},${h}`} fill="currentColor" fillOpacity={0.1} />
      <motion.polyline
        points={pts.join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: DUR.slow, ease: EASE_OUT }}
      />
      <motion.circle cx={w} cy={cy} r={3} fill="currentColor" />
    </svg>
  );
}
