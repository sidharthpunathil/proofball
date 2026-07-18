"use client";

import { useStore } from "@/lib/store";
import { useFixture } from "@/lib/fixture-context";
import type { Prediction } from "@/lib/types";
import { Share } from "./Icons";

/** Share an "I called it" card for a winning pick (Web Share API → new tab). */
export default function ShareButton({ pick }: { pick: Prediction }) {
  const streak = useStore((s) => s.streak);
  const fixture = useFixture();

  const ogUrl = () => {
    const q = new URLSearchParams({
      result: pick.status === "won" ? "won" : "lost",
      pick: pick.dir ?? "up",
      delta: String(pick.delta ?? 0),
      streak: String(streak),
      home: fixture.home.abbr,
      away: fixture.away.abbr,
    });
    return `/api/og?${q.toString()}`;
  };

  const share = async () => {
    const url = new URL(ogUrl(), window.location.origin).toString();
    const text = `I called the ${fixture.home.abbr} win-probability on ProofBall, verified on Solana.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "ProofBall", text, url });
        return;
      }
    } catch {
      /* cancelled */
    }
    window.open(url, "_blank", "noopener");
  };

  return (
    <button
      type="button"
      onClick={share}
      className="flex items-center gap-1 rounded-md border border-line bg-subtle px-1.5 py-1 text-[10px] font-semibold text-ink2 transition-transform active:scale-[0.96] hover:text-ink"
      title="Share your call"
    >
      <Share size={12} /> share
    </button>
  );
}
