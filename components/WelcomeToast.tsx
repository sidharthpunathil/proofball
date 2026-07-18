"use client";

import { useEffect } from "react";
import { m, AnimatePresence, useReducedMotion } from "framer-motion";
import { useStore } from "@/lib/store";
import { springPop, tweenFast, EASE_BACK, DUR } from "@/lib/motion";
import { PROOF } from "@/lib/economy";
import CountUp from "@/components/fx/CountUp";
import { ExternalLink, Close } from "./Icons";

/**
 * One-shot toast for the welcome $PROOF airdrop. Driven by store.welcome:
 *   • granted → the celebratory grant, with a link to the on-chain mint
 *   • error   → the airdrop failed after retries; offers a manual retry
 *
 * Enters on a pop spring and exits faster (tweenFast) from the same top edge —
 * spatial consistency, and exits that never linger. The grant auto-dismisses
 * sooner than the error, which carries an action worth leaving on-screen.
 */
export default function WelcomeToast() {
  const welcome = useStore((s) => s.welcome);
  const dismiss = useStore((s) => s.dismissWelcome);
  const retry = useStore((s) => s.retryAirdrop);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!welcome) return;
    // The error toast lingers longer: it has a Retry worth reading and tapping.
    const ms = welcome.kind === "granted" ? 7000 : 12000;
    const t = setTimeout(dismiss, ms);
    return () => clearTimeout(t);
  }, [welcome, dismiss]);

  return (
    <AnimatePresence>
      {welcome && (
        <m.div
          // top-3 on a real phone; at lg+ the app sits inside the device frame,
          // whose 46px status bar + Dynamic Island (a sibling of the isolated
          // .stage, so they paint OVER any z-index here) would clip the toast —
          // drop it below them there. See the device-frame block in globals.css.
          className="pointer-events-none fixed inset-x-0 top-3 lg:top-14 z-[60] flex justify-center px-4"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -20, transition: tweenFast }}
          transition={reduce ? tweenFast : springPop}
        >
          {welcome.kind === "granted" ? (
            <div className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-card">
              <CoinBadge tone="grn" reduce={reduce} />
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
                  className="shrink-0 text-mut transition-transform active:scale-90"
                  aria-label="View airdrop on Solana explorer"
                >
                  <ExternalLink size={15} />
                </a>
              )}
              <CloseButton onClick={dismiss} />
            </div>
          ) : (
            <div className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-amber/30 bg-surface px-4 py-3 shadow-card">
              <CoinBadge tone="amber" reduce={reduce} />
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold leading-snug text-ink">
                  Couldn&apos;t load your airdrop
                </div>
                <div className="text-[12px] text-mut">
                  Your {PROOF.airdrop.toLocaleString()} $PROOF is waiting. Tap Retry to claim it.
                </div>
              </div>
              <button
                type="button"
                onClick={retry}
                className="shrink-0 rounded-full bg-amber/15 px-3.5 py-1.5 text-[13px] font-semibold text-amber transition-transform active:scale-[0.96]"
              >
                Retry
              </button>
              <CloseButton onClick={dismiss} />
            </div>
          )}
        </m.div>
      )}
    </AnimatePresence>
  );
}

/**
 * The circular coin badge. It spins and pops in on the app's back-easing curve,
 * matching the settlement badges. Never from scale(0): even the reduced-motion
 * fallback keeps the coin fully formed, it just skips the flourish.
 */
/** A muted ✕ so the toast is always manually dismissible, not just on the timer. */
function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Dismiss"
      className="-mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-mut transition-transform active:scale-90"
    >
      <Close size={15} />
    </button>
  );
}

function CoinBadge({ tone, reduce }: { tone: "grn" | "amber"; reduce: boolean | null }) {
  const skin = tone === "grn" ? "bg-grnsoft text-grn" : "bg-amber/15 text-amber";
  return (
    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${skin}`}>
      {reduce ? (
        <img src="/proof-mark.png" alt="" className="h-auto w-[22px] shrink-0" />
      ) : (
        <m.span
          className="inline-flex"
          initial={{ rotate: -180, scale: 0.4, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          transition={{ duration: DUR.base, ease: EASE_BACK }}
        >
          <img src="/proof-mark.png" alt="" className="h-auto w-[22px] shrink-0" />
        </m.span>
      )}
    </div>
  );
}
