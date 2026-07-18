"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { useFixture } from "@/lib/fixture-context";
import type { Prediction } from "@/lib/types";
import { playSound } from "@/lib/sound";
import { Share } from "./Icons";

/**
 * Share a settled call as the generated earnings card (/api/og).
 *
 * Three rungs, best first:
 *   1. navigator.share with the PNG as a FILE, on phones this opens the native
 *      sheet and the actual image lands in X / WhatsApp / Instagram.
 *   2. X intent tweet with the /call permalink, whose twitter:card metadata
 *      unfurls the same card as a big image under the tweet.
 *   3. (implicit) the permalink itself, if a share sheet exists but can't
 *      take files.
 */
export default function ShareButton({ pick }: { pick: Prediction }) {
  const streak = useStore((s) => s.streak);
  const fixture = useFixture();
  const [busy, setBusy] = useState(false);

  const params = () => {
    const q = new URLSearchParams({
      result: pick.status === "won" ? "won" : "lost",
      pick: pick.dir ?? "up",
      delta: (pick.delta ?? 0).toFixed(1),
      reward: String(Math.abs(pick.reward ?? 0)),
      streak: String(streak),
      home: fixture.home.abbr,
      away: fixture.away.abbr,
    });
    if (pick.atMinute != null) q.set("min", String(pick.atMinute));
    return q;
  };

  const share = async () => {
    if (busy) return;
    playSound("press");
    setBusy(true);
    const q = params();
    const imgUrl = new URL(`/api/og?${q}`, window.location.origin).toString();
    const pageUrl = new URL(`/call?${q}`, window.location.origin).toString();
    const text =
      pick.status === "won"
        ? `I called it: +${Math.abs(pick.reward ?? 0)} $PROOF on ${fixture.home.abbr} vs ${fixture.away.abbr}, ${
            pick.dir === "down" ? "Falling" : "Rising"
          }${pick.atMinute != null ? ` at ${pick.atMinute}'` : ""}. Every call settles against on-chain World Cup data.`
        : `Calling the ${fixture.home.abbr} vs ${fixture.away.abbr} odds on ProofBall, provably fair on Solana.`;

    try {
      // Rung 1: native sheet with the real image file.
      if (typeof navigator.share === "function" && typeof navigator.canShare === "function") {
        const blob = await fetch(imgUrl).then((r) => (r.ok ? r.blob() : Promise.reject(new Error("og fetch"))));
        const file = new File([blob], "proofball-call.png", { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text: `${text} ${pageUrl}` });
          return;
        }
        // Sheet exists but can't take files: share the unfurling permalink.
        await navigator.share({ title: "ProofBall", text, url: pageUrl });
        return;
      }
    } catch (e) {
      // Closing the native sheet is a decision, not a failure: don't then
      // shove an X compose window at them. Real failures fall through to X.
      if ((e as DOMException)?.name === "AbortError") {
        setBusy(false);
        return;
      }
    } finally {
      setBusy(false);
    }

    // Rung 2: X intent; the permalink unfurls the card under the tweet.
    const intent = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(pageUrl)}`;
    window.open(intent, "_blank", "noopener");
  };

  return (
    <button
      type="button"
      onClick={share}
      disabled={busy}
      className="flex items-center gap-1 rounded-md border border-line bg-subtle px-1.5 py-1 text-[10px] font-semibold text-ink2 transition-transform active:scale-[0.96] hover:text-ink disabled:opacity-60"
      title="Share this call"
    >
      <Share size={12} /> {busy ? "…" : "share"}
    </button>
  );
}
