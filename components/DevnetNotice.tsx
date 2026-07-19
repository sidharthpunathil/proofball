"use client";

import { useEffect, useState } from "react";
import { m, AnimatePresence, useReducedMotion } from "framer-motion";
import { useStore } from "@/lib/store";
import { DUR, EASE_OUT } from "@/lib/motion";
import { Info, Close } from "./Icons";

// One-time nudge shown after a wallet connects. ProofBall lives entirely on
// Solana Devnet, but most wallets default to Mainnet, so a freshly-connected
// user sees a mainnet balance and none of their $PROOF. A web dApp can't read
// or change a Solana wallet's selected network (there is no equivalent of EVM's
// wallet_switchEthereumChain, and wallets report every chain they support, not
// the active one), so we can't detect the mismatch , we just guide the switch.
// Dismissible, and remembered so it never nags twice.
const SEEN_KEY = "pb:devnetNoticeSeen";

export default function DevnetNotice() {
  const user = useStore((s) => s.user);
  const reduce = useReducedMotion();
  // Start dismissed so the first client render matches the server (which has no
  // localStorage); the real state is read on mount.
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(SEEN_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  const close = () => {
    setDismissed(true);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* best-effort */
    }
  };

  const show = !!user && !dismissed;

  return (
    <AnimatePresence>
      {show && (
        <m.div
          initial={reduce ? false : { opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
          transition={{ duration: DUR.fast, ease: EASE_OUT }}
          className="overflow-hidden px-4"
        >
          <div className="mt-3 flex items-start gap-3 rounded-2xl border border-line bg-subtle px-4 py-3">
            <span
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: "rgb(var(--amber) / 0.16)", color: "rgb(var(--amber))" }}
            >
              <Info size={14} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-ink">Playing on Solana Devnet</p>
              <p className="mt-0.5 text-[12.5px] leading-[1.45] text-ink2">
                If your wallet shows a mainnet balance, switch its network to{" "}
                <span className="font-semibold text-ink">Devnet</span> to see your $PROOF and devnet SOL.
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Dismiss"
              className="-mr-1 -mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-mut transition-colors hover:text-ink active:scale-95"
            >
              <Close size={15} />
            </button>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
