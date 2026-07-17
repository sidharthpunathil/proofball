"use client";

import { useCallback, useEffect, useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import type { WalletError } from "@solana/wallet-adapter-base";
import { clusterApiUrl, type Cluster } from "@solana/web3.js";
import { useStore } from "@/lib/store";

/**
 * Solana wallet connection for the whole app.
 *
 * Real, well-known wallets (Phantom, Solflare, Backpack, ...) are discovered
 * automatically via the Wallet Standard, so we pass an empty adapters array and
 * let the provider surface whatever the user has installed. There is no
 * third-party auth service and no embedded / custodial wallet: your identity is
 * simply the public key of the wallet you connect. That is the whole point of a
 * provably-fair app, you hold your own key.
 */

// Wallet-lifecycle errors that are a normal part of connecting/disconnecting and
// must NOT crash the app or trip the Next dev error overlay: the wallet emitting
// a disconnect (extension locked, account switched), the user closing/declining
// the approve popup, or a connect firing before a wallet is selected. We handle
// these silently; the SignInGate effect already signs the user out on disconnect.
const BENIGN_WALLET_ERRORS = new Set([
  "WalletDisconnectedError",
  "WalletNotConnectedError",
  "WalletNotSelectedError",
  "WalletConnectionError",
  "WalletWindowClosedError",
  "WalletWindowBlockedError",
  "WalletAccountError",
  "WalletDisconnectionError",
  "WalletNotReadyError",
]);

export function Providers({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(() => {
    const cluster = (process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "devnet") as Cluster;
    try {
      return clusterApiUrl(cluster);
    } catch {
      return clusterApiUrl("devnet");
    }
  }, []);

  // Providing onError overrides wallet-adapter's default (which console.errors
  // every event — that is what surfaces WalletDisconnectedError as a crash-like
  // overlay in dev). We drop the benign lifecycle errors and only warn on the
  // genuinely unexpected ones, and never re-throw, so nothing bubbles uncaught.
  const onError = useCallback((error: WalletError) => {
    if (BENIGN_WALLET_ERRORS.has(error?.name)) return;
    console.warn("[wallet]", error?.name, error?.message);
  }, []);

  // The store persists user progress (your calls, coins, streak) to localStorage
  // but skips auto-hydration to stay SSR-safe. Rehydrate once on mount so a
  // reload restores that state instead of showing an empty "Your calls".
  useEffect(() => {
    void useStore.persist.rehydrate();
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[]} autoConnect onError={onError}>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
