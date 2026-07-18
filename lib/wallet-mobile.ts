/**
 * Mobile wallet helpers.
 *
 * A phone browser (Chrome/Safari/Brave) can't run a wallet browser *extension*,
 * so `window.solana` is never injected there and no wallet ever reaches
 * `readyState === Installed` — the signal desktop relies on. Two real paths
 * exist on mobile instead:
 *
 *   1. Android: @solana/wallet-adapter-react auto-adds a Mobile Wallet Adapter
 *      (readyState `Loadable`). Selecting it launches the installed wallet
 *      (Phantom, Solflare, …) over the native MWA association intent. No code
 *      here is needed for that — SignInGate just has to stop filtering it out.
 *
 *   2. iOS (and as an Android fallback): deep-link the *current* page into the
 *      wallet's own in-app browser. Inside that browser the wallet injects a
 *      Wallet Standard provider exactly like the extension, so the normal
 *      connect flow works unchanged. That's what the browse links below do.
 */

export interface MobileEnv {
  isMobile: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  /** True when already running inside a wallet's in-app browser (a provider is
   *  injected), where deep-linking out to a wallet would be pointless. */
  inWalletBrowser: boolean;
}

// Only meaningful in the browser; returns an all-false env on the server so the
// first client render can match SSR (see SignInGate's `mounted` gate).
export function detectMobileEnv(): MobileEnv {
  if (typeof navigator === "undefined") {
    return { isMobile: false, isIOS: false, isAndroid: false, inWalletBrowser: false };
  }
  const ua = navigator.userAgent || "";
  // iPadOS 13+ reports a desktop UA but is touch + Mac — treat as iOS.
  const isIPadOS = /Macintosh/.test(ua) && typeof document !== "undefined" && "ontouchend" in document;
  const isIOS = /iphone|ipod|ipad/i.test(ua) || isIPadOS;
  const isAndroid = /android/i.test(ua);
  const w = window as unknown as {
    solana?: { isPhantom?: boolean };
    phantom?: { solana?: unknown };
    solflare?: { isSolflare?: boolean };
    backpack?: unknown;
  };
  const inWalletBrowser = !!(w.solana || w.phantom?.solana || w.solflare || w.backpack);
  return { isMobile: isIOS || isAndroid, isIOS, isAndroid, inWalletBrowser };
}

// Phantom "browse" universal link — opens `url` inside Phantom's in-app browser.
// Both params are percent-encoded per Phantom's deep-link spec.
export function phantomBrowseUrl(url: string, ref: string): string {
  return `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(ref)}`;
}

// Solflare's equivalent browse deep link.
export function solflareBrowseUrl(url: string, ref: string): string {
  return `https://solflare.com/ul/v1/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(ref)}`;
}

// Build the mobile deep-link options for the current page. Called post-mount so
// window.location is real; each entry re-reads href at build time so it stays
// correct across in-app SPA navigation between matches.
export function mobileWalletLinks() {
  const url = window.location.href;
  const ref = window.location.origin;
  return [
    { name: "Phantom", href: phantomBrowseUrl(url, ref), install: "https://phantom.app/" },
    { name: "Solflare", href: solflareBrowseUrl(url, ref), install: "https://solflare.com/" },
  ];
}
