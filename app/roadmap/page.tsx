import type { Metadata } from "next";
import Link from "next/link";
import {
  ChevronLeft,
  Lock,
  Check,
  Broadcast,
  User,
  Trophy,
  ExternalLink,
} from "@/components/Icons";
import ThemeToggle from "@/components/ThemeToggle";

const DESCRIPTION =
  "Where ProofBall goes next: trustless on-chain escrow, more leagues then more sports, friends pools, and season-long leaderboards.";

export const metadata: Metadata = {
  title: "Roadmap",
  description: DESCRIPTION,
  alternates: { canonical: "/roadmap" },
  openGraph: {
    title: "Roadmap · ProofBall",
    description: DESCRIPTION,
    url: "/roadmap",
  },
};

// Plain-language roadmap, sourced from docs/WHITEPAPER.md (the "Roadmap" section).
const PHASES: { Icon: typeof Lock; title: string; body: string }[] = [
  {
    Icon: Lock,
    title: "Trustless escrow",
    body: "Move the prize pool into on-chain code that pays winners by rule. No one, not even us, can reach into the pot.",
  },
  {
    Icon: Broadcast,
    title: "More leagues, then more sports",
    body: "Live matches next, then club football like the Premier League, La Liga and the Champions League, then other sports.",
  },
  {
    Icon: User,
    title: "Friends pools",
    body: "Everyone throws $PROOF into one pot. Whoever calls it right splits the winnings, minus a small fixed rake.",
  },
  {
    Icon: Trophy,
    title: "Season leaderboards",
    body: "Standings that run the whole season, so one great call in the final still counts toward where you finish.",
  },
];

export default function RoadmapPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pb-16 pt-8">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="group flex items-center gap-1 text-[13px] font-semibold text-ink2 transition-colors hover:text-ink"
        >
          <ChevronLeft size={18} className="transition-transform motion-safe:group-hover:-translate-x-0.5" />
          Lobby
        </Link>
        <ThemeToggle className="lg:hidden" />
      </div>

      <div className="mt-6 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/proofball-logo.png"
          alt="ProofBall"
          className="h-9 w-9 shrink-0 rounded-xl shadow-soft ring-1 ring-black/5"
        />
        <h1 className="text-[32px] font-extrabold leading-[1.08] tracking-[-0.02em] text-ink">
          Roadmap
        </h1>
      </div>
      <p className="mt-2 text-[13px] text-ink2">
        Where ProofBall is today, and where it is headed.
      </p>

      {/* Now · what is live today */}
      <div className="mt-6 rounded-[20px] border border-grn/30 bg-grnsoft p-5">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-grn">
          <span className="h-1.5 w-1.5 rounded-full bg-grn" />
          Live now · beta
        </div>
        <div className="mt-2 text-[16px] font-bold leading-snug text-ink">
          Play the World Cup on Solana devnet
        </div>
        <p className="mt-1 text-[13px] leading-[1.5] text-ink2">
          30 real knockout matches to replay, with real de-margined odds. Every pick and final score is
          written to Solana, so you can check the game graded you honestly.
        </p>
      </div>

      {/* Just shipped · the $PROOF token now has an on-chain name + logo */}
      <div className="mt-3 flex items-start gap-3 rounded-2xl border border-grn/30 bg-grnsoft/60 p-4">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-grn/15 text-grn">
          <Check size={16} />
        </span>
        <p className="text-[13px] leading-[1.45] text-ink2">
          <span className="font-semibold text-ink">Just shipped:</span> $PROOF now carries on-chain
          metadata, so wallets like Phantom show it as <span className="font-semibold text-ink">ProofBall</span>{" "}
          with a logo, not a raw address.
        </p>
      </div>

      <div className="mb-1 mt-9 px-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-mut">
        What is next
      </div>

      <ol className="mt-4 flex flex-col">
        {PHASES.map((p, i) => {
          const last = i === PHASES.length - 1;
          const Icon = p.Icon;
          return (
            <li key={p.title} className="flex gap-4">
              {/* rail */}
              <div className="flex flex-col items-center">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink2 shadow-soft">
                  <Icon size={17} />
                </span>
                {!last && <span aria-hidden className="mt-1.5 w-px flex-1 bg-line" />}
              </div>
              {/* card */}
              <div className={`min-w-0 flex-1 ${last ? "" : "pb-5"}`}>
                <div className="rounded-2xl border border-line bg-surface p-4 shadow-soft">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-mut">
                    Phase {i + 1}
                  </div>
                  <div className="mt-1 text-[15px] font-bold leading-snug text-ink">{p.title}</div>
                  <p className="mt-1 text-[13px] leading-[1.45] text-ink2">{p.body}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-auto pt-10 text-center text-[12px] leading-[1.6] text-mut">
        This is the plan, not a promise of dates.
        <br />
        <a
          href="/ProofBall-Whitepaper.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-ink2 transition-colors hover:text-ink"
        >
          Read the full version in the whitepaper
          <ExternalLink size={12} />
        </a>
      </div>
    </main>
  );
}
