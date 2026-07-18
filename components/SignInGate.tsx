"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { m, AnimatePresence, useReducedMotion, type Variants } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState, type WalletName } from "@solana/wallet-adapter-base";
import { useStore } from "@/lib/store";
import { playSound } from "@/lib/sound";
import { DUR, EASE_OUT, springPop, listContainer, listItem } from "@/lib/motion";
import { detectMobileEnv, mobileWalletLinks, type MobileEnv } from "@/lib/wallet-mobile";
import { ShieldCheck, ExternalLink } from "./Icons";

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
  // Mobile env (userAgent + injected provider) also only resolves client-side,
  // so it's captured in the same post-mount step and starts as the desktop
  // default — keeping the first client render identical to the server's.
  const [env, setEnv] = useState<MobileEnv>({
    isMobile: false,
    isIOS: false,
    isAndroid: false,
    inWalletBrowser: false,
  });
  useEffect(() => {
    setMounted(true);
    setEnv(detectMobileEnv());
  }, []);

  // We only ever auto-connect right after the user taps a wallet in the gate.
  // Being "selected but not connected" is also the state that Sign out and an
  // in-wallet account switch leave you in — reconnecting on that state alone
  // (the old behaviour) made disconnect impossible and spammed the approve
  // popup. autoConnect on the provider still restores the session on reload.
  const wantConnectRef = useRef(false);

  // Identity always mirrors the *currently connected* key. Signs in on the first
  // connect, and re-signs when the wallet switches to a different account (a
  // Phantom account switch changes publicKey in place), so the stored address
  // never goes stale — settles and airdrops always target the live wallet.
  useEffect(() => {
    if (!publicKey) return;
    const addr = publicKey.toBase58();
    if (storeUser?.wallet !== addr) signIn(shortAddr(addr), addr);
  }, [publicKey, storeUser?.wallet, signIn]);

  // Wallet fully gone — extension locked, account de-authorised, or Sign out.
  // Guarded on !connecting && !publicKey so a transient blip mid-reconnect
  // doesn't flash the gate; a real disconnect settles here and shows it.
  useEffect(() => {
    if (storeUser && !connected && !connecting && !publicKey) signOut();
  }, [storeUser, connected, connecting, publicKey, signOut]);

  // Connect only when the user asked to (wantConnectRef), and only for a freshly
  // selected wallet. Re-tapping an already-selected wallet is handled directly
  // in pickWallet below, since select() would be a no-op and never fire this.
  useEffect(() => {
    if (!wantConnectRef.current) return;
    if (wallet && !connected && !connecting) {
      wantConnectRef.current = false;
      void connect().catch(() => {});
    }
  }, [wallet, connected, connecting, connect]);

  // Tapping a wallet: if it is already the selected one (e.g. right after Sign
  // out, where the wallet stays selected), connect straight away; otherwise flag
  // intent and select it, letting the effect above connect once it is active.
  const pickWallet = useCallback(
    (name: WalletName) => {
      playSound("press");
      if (wallet?.adapter.name === name) {
        if (!connected && !connecting) void connect().catch(() => {});
      } else {
        wantConnectRef.current = true;
        select(name);
      }
    },
    [wallet, connected, connecting, connect, select],
  );

  // Connectable = browser-injected wallets (readyState Installed — the extension
  // or a wallet's in-app browser) PLUS Loadable adapters. On Android the latter
  // is wallet-adapter's auto-added Mobile Wallet Adapter; the old `=== Installed`
  // filter discarded it, which is why Android saw "no wallet found" despite MWA
  // being right there. Tapping it launches the wallet over the native MWA intent.
  const connectable = mounted
    ? wallets.filter(
        (w) => w.readyState === WalletReadyState.Installed || w.readyState === WalletReadyState.Loadable,
      )
    : [];

  // Deep-link into a wallet's in-app browser on mobile — the only path on iOS,
  // and a fallback on Android if MWA can't hand off to a wallet. Never on
  // desktop, and never when a provider is already injected (i.e. we're inside a
  // wallet browser), where it would just loop.
  const showDeeplinks = mounted && env.isMobile && !env.inWalletBrowser;
  // Safe to read window.location here: showDeeplinks implies mounted (client).
  const links = showDeeplinks ? mobileWalletLinks() : [];

  return (
    <AnimatePresence>
      {!storeUser && (
        <m.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/25 backdrop-blur-sm"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <m.div
            className="relative w-full max-w-md rounded-t-[30px] border border-line bg-surface p-6 pb-9 shadow-card"
            initial={reduce ? false : { y: "100%" }}
            animate={{ y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "100%", transition: { duration: DUR.fast, ease: EASE_OUT } }}
            transition={{ duration: 0.34, ease: [0.32, 0.72, 0, 1] }}
          >
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-line2" />
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <m.img
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

            {connectable.length > 0 ? (
              <m.div
                className="mt-5 flex flex-col gap-2"
                variants={reduce ? undefined : walletCascade}
                initial={reduce ? false : "hidden"}
                animate={reduce ? false : "show"}
              >
                {connectable.map((w) => {
                  const isThis = wallet?.adapter.name === w.adapter.name;
                  // Injected (Installed) wallets are "Detected"; a Loadable one
                  // (the Android Mobile Wallet Adapter) is a "Connect" hand-off.
                  const idle = w.readyState === WalletReadyState.Installed ? "Detected" : "Connect";
                  const label = connecting && isThis ? "Connecting…" : idle;
                  return (
                    <m.button
                      key={w.adapter.name}
                      variants={reduce ? undefined : listItem}
                      whileTap={reduce ? undefined : { scale: 0.98 }}
                      onClick={() => pickWallet(w.adapter.name)}
                      disabled={connecting}
                      className="flex items-center gap-3 rounded-2xl border border-line bg-subtle px-4 py-3.5 text-[15px] font-semibold text-ink transition-transform active:scale-[0.98] disabled:opacity-60"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={w.adapter.icon} alt="" className="h-6 w-6 rounded" />
                      {w.adapter.name}
                      <span className="ml-auto text-[12px] font-medium text-mut">
                        <AnimatePresence mode="wait" initial={false}>
                          <m.span
                            key={label}
                            initial={reduce ? false : { opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: reduce ? 0 : DUR.micro }}
                          >
                            {label}
                          </m.span>
                        </AnimatePresence>
                      </span>
                    </m.button>
                  );
                })}
                {/* Android MWA sometimes can't hand off (Brave, no MWA wallet).
                    A quiet escape hatch: open ProofBall inside the wallet itself. */}
                {showDeeplinks && (
                  <m.p variants={reduce ? undefined : listItem} className="mt-1 text-center text-[12px] text-mut">
                    Not connecting?{" "}
                    {links.map((l, i) => (
                      <span key={l.name}>
                        {i > 0 && " or "}
                        <a href={l.href} className="font-medium text-grn underline underline-offset-2">
                          open in {l.name}
                        </a>
                      </span>
                    ))}
                  </m.p>
                )}
              </m.div>
            ) : showDeeplinks ? (
              <m.div
                className="mt-5 flex flex-col gap-2"
                variants={reduce ? undefined : walletCascade}
                initial={reduce ? false : "hidden"}
                animate={reduce ? false : "show"}
              >
                <m.p variants={reduce ? undefined : listItem} className="mb-1 text-center text-[13px] text-mut">
                  Open ProofBall in your wallet to connect:
                </m.p>
                {links.map((l) => (
                  <m.a
                    key={l.name}
                    variants={reduce ? undefined : listItem}
                    whileTap={reduce ? undefined : { scale: 0.98 }}
                    href={l.href}
                    onClick={() => playSound("press")}
                    className="flex items-center justify-between rounded-2xl border border-line bg-subtle px-4 py-3.5 text-[15px] font-semibold text-ink transition-transform active:scale-[0.98]"
                  >
                    {l.name}
                    <span className="flex items-center gap-1 text-[12px] font-medium text-grn">
                      Open <ExternalLink size={13} />
                    </span>
                  </m.a>
                ))}
                <m.p variants={reduce ? undefined : listItem} className="mt-1 text-center text-[12px] text-mut">
                  No wallet yet?{" "}
                  {links.map((l, i) => (
                    <span key={l.name}>
                      {i > 0 && " · "}
                      <a href={l.install} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                        Install {l.name}
                      </a>
                    </span>
                  ))}
                </m.p>
              </m.div>
            ) : (
              <m.div
                className="mt-5 flex flex-col gap-2"
                variants={reduce ? undefined : walletCascade}
                initial={reduce ? false : "hidden"}
                animate={reduce ? false : "show"}
              >
                <m.p
                  variants={reduce ? undefined : listItem}
                  className="mb-1 text-center text-[13px] text-mut"
                >
                  No Solana wallet found. Install one to continue:
                </m.p>
                {KNOWN.map((k) => (
                  <m.a
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
                  </m.a>
                ))}
              </m.div>
            )}

            <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11.5px] text-mut">
              <ShieldCheck size={13} className="text-grn" /> Your key is your identity. Nothing custodial.
            </p>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
