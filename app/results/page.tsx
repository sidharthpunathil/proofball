import type { Metadata } from "next";
import Link from "next/link";
import { getFinishedMatchesByRound } from "@/lib/matches";
import { ChevronLeft, ShieldCheck } from "@/components/Icons";
import ThemeToggle from "@/components/ThemeToggle";
import LobbyCard from "@/components/LobbyCards";
import ResultCard from "@/components/ResultCard";

export const dynamic = "force-dynamic";

const DESCRIPTION =
  "Every World Cup knockout result, each scoreline verified on-chain. Browse the full bracket, round by round, on ProofBall.";

export const metadata: Metadata = {
  title: "Previous matches",
  description: DESCRIPTION,
  alternates: { canonical: "/results" },
  openGraph: {
    title: "Previous matches · ProofBall",
    description: DESCRIPTION,
    url: "/results",
  },
};

export default async function ResultsPage() {
  const groups = await getFinishedMatchesByRound();
  const total = groups.reduce((n, g) => n + g.matches.length, 0);

  // Global running index so cards stagger in smoothly across all rounds.
  let idx = 0;

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

      <h1 className="mt-6 text-[32px] font-extrabold leading-[1.08] tracking-[-0.02em] text-ink">
        Previous matches
      </h1>
      <p className="mt-2 flex items-center gap-1.5 text-[13px] text-ink2">
        <ShieldCheck size={14} className="text-grn" />
        {total} World Cup knockout results, every score verified on-chain.
      </p>

      {total === 0 ? (
        <div className="mt-10 rounded-2xl border border-line bg-surface px-6 py-10 text-center text-[13.5px] leading-[1.5] text-ink2 shadow-soft">
          No results cached yet. Run <span className="text-ink">npm run matches:sync</span> to pull the
          finished matches from the TxLINE feed.
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-7">
          {groups.map((g) => (
            <section key={g.round}>
              <div className="mb-2.5 flex items-center justify-between px-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-mut">
                  {g.round}
                </span>
                <span className="rounded-full bg-subtle px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ink2">
                  {g.matches.length}
                </span>
              </div>
              <div className="flex flex-col gap-2.5">
                {g.matches.map((f) => (
                  <LobbyCard key={f.id} index={idx++}>
                    <ResultCard fixture={f} showRound={false} />
                  </LobbyCard>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="mt-auto pt-10 text-center text-[12px] leading-[1.6] text-mut">
        Results synced from the TxLINE World Cup feed (competition&nbsp;72) into Postgres.
        <br />
        Tap any match to replay its real event log.
      </div>
    </main>
  );
}
