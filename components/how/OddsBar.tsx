"use client";

import { m, useReducedMotion, type Variants } from "framer-motion";
import { EASE_OUT } from "@/lib/motion";

/**
 * OddsBar, the "adds up to exactly 100%" strip on /how-it-works. The three
 * segments fill left to right when scrolled into view, then their labels fade
 * in, a one-shot that acts out the sentence above it (the bar literally
 * assembles into a full 100%). Static under reduced motion.
 */
const SEGMENTS = [
  { label: "ESP 42%", pct: 42, className: "bg-grn text-white" },
  { label: "Draw 31%", pct: 31, className: "bg-line2 text-ink" },
  { label: "27% ARG", pct: 27, className: "bg-red text-white" },
];

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.14 } },
};
const labelIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { delay: 0.4, duration: 0.3 } },
};

export default function OddsBar() {
  const reduce = useReducedMotion();

  return (
    <m.div
      className="mt-4 flex h-8 w-full overflow-hidden rounded-full text-[11px] font-bold"
      initial={reduce ? false : "hidden"}
      whileInView={reduce ? undefined : "show"}
      viewport={{ once: true, margin: "-40px" }}
      variants={container}
    >
      {SEGMENTS.map((s) => (
        <m.div
          key={s.label}
          className={`flex items-center justify-center overflow-hidden whitespace-nowrap ${s.className}`}
          variants={{
            hidden: { width: "0%" },
            show: { width: `${s.pct}%`, transition: { duration: 0.55, ease: EASE_OUT } },
          }}
        >
          <m.span variants={labelIn}>{s.label}</m.span>
        </m.div>
      ))}
    </m.div>
  );
}
