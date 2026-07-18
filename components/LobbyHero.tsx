"use client";

import { m, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { tweenBase } from "@/lib/motion";

// Client-only motion island for the lobby hero (eyebrow + title + intro).
// The page itself stays a server component; this wrapper only rises the header
// block in so it leads into the staggered card cascade below.
export default function LobbyHero({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <m.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={tweenBase}
    >
      {children}
    </m.div>
  );
}
