"use client";

import { useEffect } from "react";

/**
 * Root error boundary for the App Router.
 *
 * Its main job is graceful recovery from a `ChunkLoadError`: after a dev restart
 * or a production deploy, an already-open tab holds HTML that references the old
 * build's chunk filenames. Those chunks no longer exist, so the next navigation
 * throws "Loading chunk … failed". The fix is simply to reload — the fresh HTML
 * points at the new chunk names.
 *
 * We guard the reload with a short-lived sessionStorage stamp so a chunk that is
 * genuinely unreachable (e.g. the server is down) can't trap the tab in a reload
 * loop: we auto-reload at most once every 10s, and fall back to the manual UI.
 */
function isChunkLoadError(error: Error): boolean {
  return (
    error.name === "ChunkLoadError" ||
    /Loading chunk [\w./%[\]-]+ failed/i.test(error.message) ||
    /ChunkLoadError/i.test(error.message)
  );
}

const RELOAD_STAMP = "pb:chunk-reload-at";
const RELOAD_COOLDOWN_MS = 10_000;

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (!isChunkLoadError(error)) return;
    try {
      const last = Number(sessionStorage.getItem(RELOAD_STAMP) ?? 0);
      if (Date.now() - last > RELOAD_COOLDOWN_MS) {
        sessionStorage.setItem(RELOAD_STAMP, String(Date.now()));
        window.location.reload();
      }
    } catch {
      // sessionStorage unavailable (private mode / SSR) — reload unguarded once.
      window.location.reload();
    }
  }, [error]);

  const chunk = isChunkLoadError(error);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 text-center shadow-soft">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-redsoft text-red">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          </svg>
        </div>
        <h2 className="text-[17px] font-bold tracking-tight text-ink">
          {chunk ? "Updating to the latest build…" : "Something went wrong"}
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink2">
          {chunk
            ? "This tab was running an older version. Reloading to pick up the new one."
            : "An unexpected error interrupted this screen. You can try again."}
        </p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-full border border-line bg-subtle px-4 py-2 text-[13px] font-semibold text-ink transition-colors hover:bg-line"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full bg-red px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            Reload
          </button>
        </div>
        {error.digest && (
          <p className="mt-4 font-mono text-[11px] text-faint">ref: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
