"use client";

import { m, useReducedMotion } from "framer-motion";
import { EASE_OUT } from "@/lib/motion";

/**
 * Reveal, the /how-it-works section entrance: a soft fade + rise as each card
 * scrolls into view, once. Mirrors the lobby's card entrances (listItem's y: 8
 * family) so the explainer feels like the rest of the app, and stays subtle so
 * reading is never gated on motion. Under reduced motion it renders static.
 */
export default function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ delay, duration: 0.5, ease: EASE_OUT }}
    >
      {children}
    </m.div>
  );
}
