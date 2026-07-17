"use client";

import { useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { useStore } from "@/lib/store";
import { DUR, EASE_OUT } from "@/lib/motion";
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

export default function SignInGate() {
  const { wallets, select, connect, connecting, connected, publicKey, wallet } = useWallet();
  const storeUser = useStore((s) => s.user);
  const signIn = useStore((s) => s.signIn);
  const signOut = useStore((s) => s.signOut);
  const reduce = useReducedMotion();

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

  const detected = wallets.filter((w) => w.readyState === WalletReadyState.Installed);

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
            className="w-full max-w-md rounded-t-[30px] border border-line bg-surface p-6 pb-9 shadow-card"
            initial={reduce ? false : { y: "100%" }}
            animate={{ y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "100%", transition: { duration: DUR.fast, ease: EASE_OUT } }}
            transition={{ duration: 0.34, ease: [0.32, 0.72, 0, 1] }}
          >
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-line2" />
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/proofball-logo.png" alt="ProofBall" className="h-14 w-14 rounded-2xl" />
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
              <div className="mt-5 flex flex-col gap-2">
                {detected.map((w) => {
                  const isThis = wallet?.adapter.name === w.adapter.name;
                  return (
                    <button
                      key={w.adapter.name}
                      onClick={() => select(w.adapter.name)}
                      disabled={connecting}
                      className="flex items-center gap-3 rounded-2xl border border-line bg-subtle px-4 py-3.5 text-[15px] font-semibold text-ink transition-transform active:scale-[0.98] disabled:opacity-60"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={w.adapter.icon} alt="" className="h-6 w-6 rounded" />
                      {w.adapter.name}
                      <span className="ml-auto text-[12px] font-medium text-mut">
                        {connecting && isThis ? "Connecting…" : "Detected"}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-5 flex flex-col gap-2">
                <p className="mb-1 text-center text-[13px] text-mut">
                  No Solana wallet found. Install one to continue:
                </p>
                {KNOWN.map((k) => (
                  <a
                    key={k.name}
                    href={k.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-2xl border border-line bg-subtle px-4 py-3.5 text-[15px] font-semibold text-ink transition-transform active:scale-[0.98]"
                  >
                    {k.name}
                    <span className="text-[12px] font-medium text-grn">Install</span>
                  </a>
                ))}
              </div>
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
