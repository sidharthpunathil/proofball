import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "@/components/Icons";

/**
 * The share landing for a single call. Its whole job is the unfurl: posting
 * this URL on X / WhatsApp / Telegram renders the /api/og earnings card as a
 * big image (twitter:card summary_large_image). The page itself shows the same
 * card and hands the visitor straight into a match.
 */

type Params = { [key: string]: string | string[] | undefined };

const KEYS = ["result", "pick", "delta", "reward", "min", "streak", "home", "away"] as const;

function ogQuery(sp: Params): string {
  const q = new URLSearchParams();
  for (const k of KEYS) {
    const v = sp[k];
    if (typeof v === "string" && v !== "") q.set(k, v.slice(0, 12));
  }
  return q.toString();
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<Params> }): Promise<Metadata> {
  const sp = await searchParams;
  const won = (sp.result ?? "won") === "won";
  const reward = Math.abs(Number(sp.reward ?? 0)) || 50;
  const home = typeof sp.home === "string" ? sp.home : "ESP";
  const away = typeof sp.away === "string" ? sp.away : "ARG";
  const title = won ? `I called it: +${reward} $PROOF on ${home} vs ${away}` : `My call on ${home} vs ${away}`;
  const description =
    "Call which way the odds move during the match. Every result settles against on-chain World Cup data, so the house can't cheat.";
  const image = `/api/og?${ogQuery(sp)}`;
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
    robots: { index: false }, // parameterized share permalinks shouldn't be indexed
  };
}

export default async function CallSharePage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const image = `/api/og?${ogQuery(sp)}`;
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-6 py-12">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image}
        alt="A settled ProofBall call"
        className="w-full rounded-[22px] border border-line shadow-card"
      />
      <p className="mt-5 max-w-xs text-center text-[14px] leading-[1.5] text-ink2">
        Think you read the game better? Call which way the odds move, live.
      </p>
      <Link
        href="/"
        className="group mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-ink py-4 text-[15px] font-semibold text-bg shadow-btn transition-transform active:scale-[0.985]"
      >
        Make your first call
        <ArrowRight size={18} className="transition-transform motion-safe:md:group-hover:translate-x-0.5" />
      </Link>
      <p className="mt-4 flex items-center gap-1.5 text-[11.5px] text-mut">
        <ShieldCheck size={13} className="text-grn" /> Provably fair · settled on Solana
      </p>
    </main>
  );
}
