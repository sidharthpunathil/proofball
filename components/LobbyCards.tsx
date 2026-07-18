"use client";

import { m, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { tweenBase } from "@/lib/motion";

// Client-only motion wrapper for the lobby cards. The page itself stays a
// server component (it fetches fixtures); the server-rendered <Link> cards are
// passed in as children and this wrapper only adds the entrance + hover m.
export default function LobbyCard({
  children,
  index = 0,
  className,
}: {
  children: ReactNode;
  index?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <m.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        ...tweenBase,
        delay: reduce ? 0 : index * 0.045,
      }}
      whileHover={reduce ? undefined : { scale: 1.01 }}
      whileTap={reduce ? undefined : { scale: 0.985 }}
    >
      {children}
    </m.div>
  );
}
