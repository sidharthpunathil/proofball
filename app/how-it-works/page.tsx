import type { Metadata } from "next";
import Link from "next/link";
import {
  ChevronLeft,
  ArrowUpRight,
  ArrowDownRight,
  Broadcast,
  Lock,
  ShieldCheck,
  Check,
  Coin,
  Flame,
  Play,
  ArrowRight,
  ExternalLink,
  Gauge,
} from "@/components/Icons";
import ThemeToggle from "@/components/ThemeToggle";
import WinProbDemo from "@/components/how/WinProbDemo";
import RewardLadder from "@/components/how/RewardLadder";
import Reveal from "@/components/how/Reveal";
import OddsBar from "@/components/how/OddsBar";

const DESCRIPTION =
  "How ProofBall works, in plain words: watch a match, call which way a team's chance of winning moves next, and win $PROOF when you're right. Every result is checked on the blockchain.";

export const metadata: Metadata = {
  title: "How it works",
  description: DESCRIPTION,
  alternates: { canonical: "/how-it-works" },
  openGraph: {
    title: "How it works · ProofBall",
    description: DESCRIPTION,
    url: "/how-it-works",
  },
};

// The 4-step core loop, in the plainest words we have. Matches the live
// product (PredictControl + the match screen).
const LOOP: { Icon: typeof Play; title: string; body: string }[] = [
  {
    Icon: Play,
    title: "Open a match",
    body: "Pick any World Cup game. You see the team's live chance to win, moving as the game plays.",
  },
  {
    Icon: Broadcast,
    title: "Watch the number move",
    body: "Every goal, card and attack pushes it up or down. The data comes from real bookmakers, live.",
  },
  {
    Icon: ArrowUpRight,
    title: "Make your call",
    body: "Think it's going up? Tap Rising. Going down? Tap Falling. A short timer locks your pick in.",
  },
  {
    Icon: Coin,
    title: "Win $PROOF",
    body: "Minutes later the market answers. Right call, you earn $PROOF. Wrong call, you only lose a small stake.",
  },
];

// Why it's fair, one plain line each.
const FAIR: { Icon: typeof Lock; title: string; body: string }[] = [
  {
    Icon: Lock,
    title: "Your pick is time-stamped",
    body: "The second you lock a call, it is written to Solana. Proof you picked before anything happened.",
  },
  {
    Icon: ShieldCheck,
    title: "Results nobody can bend",
    body: "Scores and odds come from match data that is also locked on the blockchain. Not even we can edit it.",
  },
  {
    Icon: ExternalLink,
    title: "Check it yourself",
    body: "Every settled call has a link to Solana Explorer. You never have to take our word for it.",
  },
];

export default function HowItWorksPage() {
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
          How it works
        </h1>
      </div>
      <p className="mt-2 text-[14px] leading-[1.5] text-ink2">
        You don&apos;t bet on who wins the match. You call which way a team&apos;s chances move next.
      </p>

      {/* The big idea + the hero chart */}
      <Reveal className="mt-6">
        <div className="rounded-[22px] border border-line bg-surface p-5 shadow-card">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-grn">
            <Gauge size={13} />
            The one number
          </div>
          <div className="mt-2 text-[16px] font-bold leading-snug text-ink">
            A live &ldquo;chance to win&rdquo; that moves with the game
          </div>
          <p className="mt-1 text-[13px] leading-[1.5] text-ink2">
            Every team has a live percent chance of winning. Goals and big moments make it jump. Your only job:
            guess where it goes next.
          </p>
          <div className="mt-4">
            <WinProbDemo />
          </div>
        </div>
      </Reveal>

      {/* Why the number is trustworthy */}
      <Reveal className="mt-3">
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-soft">
          <div className="text-[15px] font-bold leading-snug text-ink">Honest odds, no house edge</div>
          <p className="mt-1 text-[13px] leading-[1.5] text-ink2">
            Bookmakers pad their odds so they always profit. We strip that padding out, so the numbers you see
            are the true chances. They always add up to exactly 100%.
          </p>
          <OddsBar />
        </div>
      </Reveal>

      {/* The loop */}
      <div className="mb-1 mt-9 px-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-mut">
        How you play
      </div>
      <ol className="mt-4 flex flex-col">
        {LOOP.map((s, i) => {
          const last = i === LOOP.length - 1;
          const Icon = s.Icon;
          return (
            <li key={s.title} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink2 shadow-soft">
                  <Icon size={17} />
                  <span className="absolute -right-1 -top-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-ink text-[10px] font-bold text-bg">
                    {i + 1}
                  </span>
                </span>
                {!last && <span aria-hidden className="mt-1.5 w-px flex-1 bg-line" />}
              </div>
              <div className={`min-w-0 flex-1 ${last ? "" : "pb-5"}`}>
                <Reveal>
                  <div className="rounded-2xl border border-line bg-surface p-4 shadow-soft">
                    <div className="text-[15px] font-bold leading-snug text-ink">{s.title}</div>
                    <p className="mt-1 text-[13px] leading-[1.45] text-ink2">{s.body}</p>
                  </div>
                </Reveal>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Rising / Falling primer */}
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <Reveal>
          <div className="h-full rounded-2xl border border-grn/30 bg-grnsoft/60 p-4">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-grn/15 text-grn">
              <ArrowUpRight size={16} />
            </span>
            <div className="mt-2 text-[14px] font-bold text-ink">Rising</div>
            <p className="mt-0.5 text-[12px] leading-[1.4] text-ink2">The chance is about to climb.</p>
          </div>
        </Reveal>
        <Reveal delay={0.08}>
          <div className="h-full rounded-2xl border border-red/30 bg-redsoft/60 p-4">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red/15 text-red">
              <ArrowDownRight size={16} />
            </span>
            <div className="mt-2 text-[14px] font-bold text-ink">Falling</div>
            <p className="mt-0.5 text-[12px] leading-[1.4] text-ink2">The chance is about to drop.</p>
          </div>
        </Reveal>
      </div>

      {/* Provably fair */}
      <div className="mb-1 mt-9 px-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-mut">
        Why you can trust it
      </div>
      <Reveal className="mt-3">
        <div className="rounded-[22px] border border-grn/30 bg-grnsoft p-5">
          <div className="text-[16px] font-bold leading-snug text-ink">The house can&apos;t cheat</div>
          <p className="mt-1 text-[13px] leading-[1.5] text-ink2">
            Everything that matters is stamped on the blockchain, where nobody can edit it. Not even us.
          </p>
          <div className="mt-4 flex flex-col gap-3">
            {FAIR.map((f) => {
              const Icon = f.Icon;
              return (
                <div key={f.title} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-grn/15 text-grn">
                    <Icon size={15} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-semibold text-ink">{f.title}</div>
                    <p className="mt-0.5 text-[12.5px] leading-[1.45] text-ink2">{f.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Reveal>

      {/* Rewards + streak ladder */}
      <div className="mb-1 mt-9 px-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-mut">
        The reward
      </div>
      <Reveal className="mt-3">
        <div className="rounded-[22px] border border-line bg-surface p-5 shadow-card">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-amber">
            <Flame size={13} />
            Streaks pay
          </div>
          <div className="mt-2 text-[16px] font-bold leading-snug text-ink">
            Right calls earn $PROOF. A hot streak earns more.
          </div>
          <p className="mt-1 text-[13px] leading-[1.5] text-ink2">
            One right call pays 50 $PROOF. Each win in a row pays more, up to six straight. A wrong call only
            ever costs 50.
          </p>
          <div className="mt-5">
            <RewardLadder />
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-subtle py-2.5 text-[12px] font-semibold text-ink2">
            <Check size={14} className="text-grn" /> Right +50 to +140
            <span className="text-line2">·</span>
            <ArrowDownRight size={14} className="text-red" /> Wrong −50
          </div>
        </div>
      </Reveal>

      {/* CTA */}
      <Reveal className="mt-9">
        <Link
          href="/"
          className="group flex items-center justify-center gap-2 rounded-2xl bg-ink py-4 text-[15px] font-semibold text-bg shadow-btn transition-transform active:scale-[0.985]"
        >
          Pick your first match
          <ArrowRight size={18} className="transition-transform motion-safe:md:group-hover:translate-x-0.5" />
        </Link>
      </Reveal>

      <div className="mt-6 flex items-center justify-center gap-4 text-[12px] font-medium text-mut">
        <Link href="/roadmap" className="transition-colors hover:text-ink">
          Roadmap
        </Link>
        <span className="text-line2">·</span>
        <a
          href="/whitepaper"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 transition-colors hover:text-ink"
        >
          Whitepaper
          <ExternalLink size={12} />
        </a>
      </div>
    </main>
  );
}
