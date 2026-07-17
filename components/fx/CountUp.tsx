"use client";

import { useEffect, useState } from "react";
import { useMotionValueEvent, useReducedMotion, useSpring, type SpringOptions } from "framer-motion";
import { springSoft } from "@/lib/motion";

/**
 * A number that springs to its target instead of jumping — the same
 * useSpring + useMotionValueEvent pattern already used inline for the
 * win-probability figure and the $PROOF balance, extracted so reward beats
 * can reuse it. Under reduced motion it snaps to the value.
 */
export default function CountUp({
  value,
  format = (n) => Math.round(n).toLocaleString(),
  spring = springSoft,
  className,
  prefix,
  suffix,
}: {
  value: number;
  format?: (n: number) => string;
  spring?: SpringOptions;
  className?: string;
  prefix?: string;
  suffix?: string;
}) {
  const reduce = useReducedMotion();
  const mv = useSpring(value, spring);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (reduce) {
      mv.jump(value);
      setDisplay(value);
    } else {
      mv.set(value);
    }
  }, [value, reduce, mv]);
  useMotionValueEvent(mv, "change", (v) => setDisplay(v));

  return (
    <span className={className}>
      {prefix}
      {format(display)}
      {suffix}
    </span>
  );
}
