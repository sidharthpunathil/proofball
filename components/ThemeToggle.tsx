"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { tweenFast } from "@/lib/motion";
import { Sun, Moon } from "./Icons";

/** Light/dark toggle. Reads the theme set pre-paint by the inline script,
 *  flips [data-theme] on <html>, and persists to localStorage. */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    const t = (document.documentElement.getAttribute("data-theme") as "light" | "dark") || "light";
    setTheme(t);
    setMounted(true);
  }, []);

  const toggle = () => {
    const next = theme === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* ignore */
    }
    setTheme(next);
  };

  return (
    <motion.button
      onClick={toggle}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      whileTap={reduce ? undefined : { scale: 0.9 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      className={`relative flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface text-ink2 transition-colors hover:text-ink ${className}`}
    >
      <AnimatePresence initial={false}>
        <motion.span
          key={theme}
          initial={reduce ? { opacity: 0 } : { rotate: -90, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { rotate: 90, opacity: 0 }}
          transition={tweenFast}
          className="absolute inset-0 flex items-center justify-center"
        >
          {mounted && theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
