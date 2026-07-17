"use client";

import { motion, useReducedMotion } from "framer-motion";

export interface SegOption<T extends string | number> {
  value: T;
  label: React.ReactNode;
  /** Accessible name when `label` is icon-only. */
  title?: string;
}

interface Props<T extends string | number> {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  /** Unique per mounted control; drives the shared-layout sliding pill. */
  layoutId: string;
  /** "solid" = high-contrast ink pill (primary switch); "soft" = subtle chip (secondary). */
  variant?: "solid" | "soft";
  ariaLabel?: string;
  className?: string;
}

// A sliding-pill segmented control. The active pill is a single element shared
// across options via `layoutId`, so switching glides it on the app's spring
// (the same treatment as the bottom-nav active dot) instead of cross-fading.
export default function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  layoutId,
  variant = "soft",
  ariaLabel,
  className = "",
}: Props<T>) {
  const reduce = useReducedMotion();
  const solid = variant === "solid";

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-0.5 rounded-full border border-line bg-subtle p-0.5 ${className}`}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            role="tab"
            aria-selected={active}
            title={opt.title}
            aria-label={opt.title}
            onClick={() => onChange(opt.value)}
            className={`relative flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold leading-none transition-colors ${
              active ? (solid ? "text-bg" : "text-ink") : "text-mut hover:text-ink2"
            }`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className={`absolute inset-0 rounded-full ${
                  solid ? "bg-ink" : "bg-surface shadow-soft ring-1 ring-line"
                }`}
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
