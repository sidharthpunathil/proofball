"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion, type Variants } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { useStore } from "@/lib/store";
import { playSound } from "@/lib/sound";
import { DUR, EASE_OUT, springPop, listContainer, listItem } from "@/lib/motion";
import { ShieldCheck } from "./Icons";

function shortAddr(a: string) {
  return a.length > 8 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}

// Well-known Solana wallets, shown with an install link when none is detected.
const KNOWN = [
  { name: "Phantom", url: "https://phantom.app/" },
  { name: "Solflare", url: "https://solflare.com/" },
  { name: "Backpack", url: "https://backpack.app/" },
];

// The wallet/install choices cascade in — but only once the sheet has slid up
// and settled, via a longer delayChildren than the shared token's default.
const walletCascade: Variants = {
  hidden: listContainer.hidden,
  show: { transition: { ...listContainer.show.transition, delayChildren: 0.2 } },
};

export default function SignInGate() {
  const { wallets, select, connect, connecting, connected, publicKey, wallet } = useWallet();
  const storeUser = useStore((s) => s.user);
  const signIn = useStore((s) => s.signIn);
  const signOut = useStore((s) => s.signOut);
  const reduce = useReducedMotion();

  // Wallet detection (readyState === Installed) only resolves in the browser, so
  // the server always sees zero wallets. Gate the detected list on a post-mount
  // flag so the FIRST client render matches the server's HTML (both take the
  // "install a wallet" branch); the real wallet list appears on the next render.
  // Without this the client detects Phantom immediately → branch mismatch → the
  // hydration error.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Wallet connected: your public key is your identity. No password, no mock.
  useEffect(() => {
    if (publicKey && !storeUser) {
      const addr = publicKey.toBase58();
      signIn(shortAddr(addr), addr);
    }
  }, [publicKey, storeUser, signIn]);

  // Wallet disconnected (from the extension or the Sign out button): sign out.
  useEffect(() => {
    if (!connected && storeUser) signOut();
  }, [connected, storeUser, signOut]);

  // Once a wallet is picked, connect to it (opens the extension's approve popup).
  useEffect(() => {
    if (wallet && !connected && !connecting) void connect().catch(() => {});
  }, [wallet, connected, connecting, connect]);

  const detected = mounted ? wallets.filter((w) => w.readyState === WalletReadyState.Installed) : [];

  return (
    <AnimatePresence>
      {!storeUser && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/25 backdrop-blur-sm"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="relative w-full max-w-md rounded-t-[30px] border border-line bg-surface p-6 pb-9 shadow-card"
            initial={reduce ? false : { y: "100%" }}
            animate={{ y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "100%", transition: { duration: DUR.fast, ease: EASE_OUT } }}
            transition={{ duration: 0.34, ease: [0.32, 0.72, 0, 1] }}
          >
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-line2" />
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <motion.img
                src="/proofball-logo.png"
                alt="ProofBall"
                className="h-14 w-14 rounded-2xl"
                initial={reduce ? false : { scale: 0.8, opacity: 0 }}
                animate={reduce ? false : { scale: 1, opacity: 1 }}
                transition={reduce ? undefined : { ...springPop, delay: 0.15 }}
              />
            </div>
            <div className="mt-4 text-center text-[24px] font-extrabold leading-[1.15] tracking-[-0.02em] text-ink">
              Don&apos;t trust the numbers.
              <br />
              Verify them.
            </div>
            <p className="mx-auto mt-2.5 max-w-xs text-center text-[13.5px] leading-[1.5] text-ink2">
              Connect a Solana wallet to make calls. Every result is settled against on-chain World Cup data,
              so the house can&apos;t cheat.
            </p>

            {detected.length > 0 ? (
              <motion.div
                className="mt-5 flex flex-col gap-2"
                variants={reduce ? undefined : walletCascade}
                initial={reduce ? false : "hidden"}
                animate={reduce ? false : "show"}
              >
                {detected.map((w) => {
                  const isThis = wallet?.adapter.name === w.adapter.name;
                  const label = connecting && isThis ? "Connecting…" : "Detected";
                  return (
                    <motion.button
                      key={w.adapter.name}
                      variants={reduce ? undefined : listItem}
                      whileTap={reduce ? undefined : { scale: 0.98 }}
                      onClick={() => {
                        playSound("press");
                        select(w.adapter.name);
                      }}
                      disabled={connecting}
                      className="flex items-center gap-3 rounded-2xl border border-line bg-subtle px-4 py-3.5 text-[15px] font-semibold text-ink transition-transform active:scale-[0.98] disabled:opacity-60"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={w.adapter.icon} alt="" className="h-6 w-6 rounded" />
                      {w.adapter.name}
                      <span className="ml-auto text-[12px] font-medium text-mut">
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.span
                            key={label}
                            initial={reduce ? false : { opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: reduce ? 0 : DUR.micro }}
                          >
                            {label}
                          </motion.span>
                        </AnimatePresence>
                      </span>
                    </motion.button>
                  );
                })}
              </motion.div>
            ) : (
              <motion.div
                className="mt-5 flex flex-col gap-2"
                variants={reduce ? undefined : walletCascade}
                initial={reduce ? false : "hidden"}
                animate={reduce ? false : "show"}
              >
                <motion.p
                  variants={reduce ? undefined : listItem}
                  className="mb-1 text-center text-[13px] text-mut"
                >
                  No Solana wallet found. Install one to continue:
                </motion.p>
                {KNOWN.map((k) => (
                  <motion.a
                    key={k.name}
                    variants={reduce ? undefined : listItem}
                    whileTap={reduce ? undefined : { scale: 0.98 }}
                    href={k.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-2xl border border-line bg-subtle px-4 py-3.5 text-[15px] font-semibold text-ink transition-transform active:scale-[0.98]"
                  >
                    {k.name}
                    <span className="text-[12px] font-medium text-grn">Install</span>
                  </motion.a>
                ))}
              </motion.div>
            )}

            <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11.5px] text-mut">
              <ShieldCheck size={13} className="text-grn" /> Your key is your identity. Nothing custodial.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
