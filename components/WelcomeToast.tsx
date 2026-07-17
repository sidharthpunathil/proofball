"use client";

import { useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useStore } from "@/lib/store";
import { springPop, tweenFast, EASE_BACK, DUR } from "@/lib/motion";
import CountUp from "@/components/fx/CountUp";
import { Coin, ExternalLink } from "./Icons";

/**
 * One-shot toast shown the first time a wallet connects and receives its
 * welcome $PROOF airdrop. Driven by store.welcome (set in signIn), auto-dismiss.
 */
export default function WelcomeToast() {
  const welcome = useStore((s) => s.welcome);
  const dismiss = useStore((s) => s.dismissWelcome);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!welcome) return;
    const t = setTimeout(dismiss, 7000);
    return () => clearTimeout(t);
  }, [welcome, dismiss]);

  return (
    <AnimatePresence>
      {welcome && (
        <motion.div
          className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex justify-center px-4"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -20 }}
          transition={reduce ? tweenFast : springPop}
        >
          <div className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-card">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-grnsoft text-grn">
              {reduce ? (
                <Coin size={18} />
              ) : (
                <motion.span
                  className="inline-flex"
                  initial={{ rotate: -180, scale: 0.4, opacity: 0 }}
                  animate={{ rotate: 0, scale: 1, opacity: 1 }}
                  transition={{ duration: DUR.base, ease: EASE_BACK }}
                >
                  <Coin size={18} />
                </motion.span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold leading-snug text-ink">
                Welcome! We airdropped you{" "}
                <CountUp value={welcome.amount} format={(v) => Math.round(v).toLocaleString()} /> $PROOF
              </div>
              <div className="text-[12px] text-mut">Free to play. Make a call to put it to work.</div>
            </div>
            {welcome.url && (
              <a
                href={welcome.url}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 text-mut transition-transform active:scale-95"
                aria-label="View airdrop on Solana explorer"
              >
                <ExternalLink size={15} />
              </a>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
