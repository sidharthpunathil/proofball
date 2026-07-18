"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { tweenFast } from "@/lib/motion";
import { useSound } from "@/lib/sound";

/** Header toggle for the app's sound. Mirrors ThemeToggle's shape/behaviour. */
export default function MuteButton({ className = "" }: { className?: string }) {
  const { muted, toggleMuted, play } = useSound();
  const [mounted, setMounted] = useState(false);
  const reduce = useReducedMotion();
  useEffect(() => setMounted(true), []);

  const onClick = () => {
    const wasMuted = muted;
    toggleMuted();
    // Play a confirming blip when turning sound ON (engine already unmuted).
    if (wasMuted) play("toggle");
  };

  // Before mount, render the "on" glyph so SSR and first paint agree; the real
  // stored state is applied on the client tick after.
  const showMuted = mounted && muted;

  return (
    <m.button
      onClick={onClick}
      aria-label={showMuted ? "Turn sound on" : "Turn sound off"}
      aria-pressed={showMuted}
      whileTap={reduce ? undefined : { scale: 0.9 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      className={`relative flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface text-ink2 transition-colors hover:text-ink ${className}`}
    >
      <AnimatePresence initial={false} mode="wait">
        <m.span
          key={showMuted ? "off" : "on"}
          initial={reduce ? { opacity: 0 } : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { scale: 0.6, opacity: 0 }}
          transition={tweenFast}
          className="absolute inset-0 flex items-center justify-center"
        >
          {showMuted ? <SpeakerOff /> : <SpeakerOn />}
        </m.span>
      </AnimatePresence>
    </m.button>
  );
}

const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function SpeakerOn() {
  return (
    <svg {...base}>
      <path d="M11 5 6 9H2v6h4l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

function SpeakerOff() {
  return (
    <svg {...base}>
      <path d="M11 5 6 9H2v6h4l5 4V5z" />
      <path d="m23 9-6 6" />
      <path d="m17 9 6 6" />
    </svg>
  );
}
