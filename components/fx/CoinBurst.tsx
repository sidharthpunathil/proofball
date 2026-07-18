"use client";

import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { EASE_OUT } from "@/lib/motion";

/**
 * A small one-shot spray of coins that fans upward from the center of its
 * container and fades — the reward flourish for a won call. Purely decorative,
 * so it renders nothing under reduced m. The parent must be `relative`.
 *
 * Retrigger by incrementing `fireKey` (e.g. a per-win token); the same value
 * re-mounts the burst so a repeat win replays it.
 */
export default function CoinBurst({
  fireKey,
  count = 6,
  size = 12,
  className = "",
}: {
  fireKey: number;
  count?: number;
  size?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return null;

  // The $PROOF mark is landscape (215×169); derive its height so each spray
  // particle stays centred on its arc (the old coin glyph was square).
  const markH = size / (215 / 169);

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-20 flex items-center justify-center ${className}`}
      aria-hidden
    >
      <AnimatePresence>
        {fireKey > 0 && (
          <m.div key={fireKey} className="relative h-0 w-0">
            {Array.from({ length: count }).map((_, i) => {
              // Fan the coins across an upward arc, with a little per-coin variety.
              const t = count > 1 ? i / (count - 1) : 0.5;
              const angle = (-140 + t * 100) * (Math.PI / 180);
              const dist = 26 + (i % 3) * 9;
              const x = Math.cos(angle) * dist;
              const y = Math.sin(angle) * dist;
              return (
                <m.span
                  key={i}
                  className="absolute left-0 top-0 drop-shadow-sm"
                  style={{ marginLeft: -size / 2, marginTop: -markH / 2 }}
                  initial={{ x: 0, y: 0, scale: 0.3, opacity: 0, rotate: 0 }}
                  animate={{
                    x,
                    y: [0, y, y + 10],
                    scale: [0.3, 1, 0.9],
                    opacity: [0, 1, 0],
                    rotate: (i % 2 ? 1 : -1) * 40,
                  }}
                  transition={{ duration: 0.62 + (i % 3) * 0.06, ease: EASE_OUT, times: [0, 0.35, 1] }}
                >
                  <img src="/proof-mark.png" alt="" style={{ width: size, height: markH }} />
                </m.span>
              );
            })}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
