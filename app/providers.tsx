"use client";

import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { clusterApiUrl, type Cluster } from "@solana/web3.js";

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
export function Providers({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(() => {
    const cluster = (process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "devnet") as Cluster;
    try {
      return clusterApiUrl(cluster);
    } catch {
      return clusterApiUrl("devnet");
    }
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[]} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
