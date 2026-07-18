import Link from "next/link";
import { getFixtures, type Fixture } from "@/lib/txline-fixtures";
import { getFinishedMatches } from "@/lib/matches";
import { ArrowRight, Trophy, ShieldCheck, Clock, ChevronRight } from "@/components/Icons";
import ThemeToggle from "@/components/ThemeToggle";
import LobbyCard from "@/components/LobbyCards";
import LobbyHero from "@/components/LobbyHero";
import Flag from "@/components/Flag";
import FloatingWinnings from "@/components/fx/FloatingWinnings";
import DemoVideo from "@/components/DemoVideo";

export const dynamic = "force-dynamic";

function kickoff(ts: number): string {
  if (!ts) return "Kick-off soon";
  const d = new Date(ts);
  const day = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return `${day} · ${time} UTC`;
}

export default async function Home() {
  const fixtures = await getFixtures();
  const featured = fixtures.find((f) => f.status !== "finished") ?? fixtures[0];

  // All finished matches come from the Postgres cache (the whole knockout
  // bracket). Fall back to the curated fixtures if the DB is empty / offline.
  const dbFinished = await getFinishedMatches();
  const finished = dbFinished.length > 0 ? dbFinished : fixtures.filter((f) => f.status === "finished");
  const latest = finished.slice(0, 3); // teaser: the most recent results

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pb-12 pt-8 lg:grid lg:min-h-0 lg:max-w-none lg:grid-cols-[1fr_minmax(0,400px)] lg:items-center lg:gap-16 lg:px-4 lg:py-0">
      <div className="lg:pl-6">
      <LobbyHero>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mut">Built on</span>
            <span className="flex items-center gap-1.5">
              <span className="inline-flex items-center rounded-md bg-white px-1.5 py-[3px] shadow-soft ring-1 ring-black/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/txline-logo.png" alt="TxLINE" className="h-3 w-auto" />
              </span>
              <span className="inline-flex items-center rounded-md bg-white px-1.5 py-[3px] shadow-soft ring-1 ring-black/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/solana-logo.svg" alt="Solana" className="h-3 w-auto" />
              </span>
            </span>
          </div>
          <ThemeToggle className="lg:hidden" />
        </div>

        <h1 className="mt-6 flex items-center gap-3 text-[44px] font-extrabold leading-[1.04] tracking-[-0.03em] text-ink lg:mt-6 lg:gap-3.5 lg:text-[58px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/proofball-logo.png"
            alt=""
            aria-hidden
            className="h-11 w-11 shrink-0 rounded-[14px] shadow-soft lg:h-[52px] lg:w-[52px] lg:rounded-[16px]"
          />
          ProofBall
        </h1>
        <p className="mt-3 text-[19px] font-semibold leading-[1.3] tracking-[-0.01em] text-ink lg:mt-4 lg:text-[23px]">
          Momentum trading for your favorite sports.
        </p>
        <p className="mt-2 text-[18px] leading-[1.5] text-ink2 lg:mt-3 lg:max-w-md lg:text-[17.5px]">
          Watch the World Cup and call which way the odds move. Every result is proven on the{" "}
          <span className="text-ink">blockchain</span>, so no one can cheat.
        </p>

        {/* On desktop the desk chrome carries these; on mobile the phone IS the
            app, so surface the same two destinations as chips under the hero. */}
        <nav className="mt-5 flex flex-wrap gap-2 lg:hidden" aria-label="About ProofBall">
          <Link
            href="/how-it-works"
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 text-[13px] font-semibold text-ink shadow-soft transition-colors active:border-line2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-mut" aria-hidden>
              <path d="M15 14c.2-1 .7-1.7 1.5-2.5A5 5 0 1 0 8.5 11.5c.8.8 1.3 1.5 1.5 2.5" />
              <path d="M9 18h6" />
              <path d="M10 22h4" />
            </svg>
            How it works
          </Link>
          <Link
            href="/roadmap"
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 text-[13px] font-semibold text-ink shadow-soft transition-colors active:border-line2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-mut" aria-hidden>
              <circle cx="6" cy="19" r="3" />
              <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
              <circle cx="18" cy="5" r="3" />
            </svg>
            Roadmap
          </Link>
        </nav>

        {/* The demo video: a click-to-play facade, so Vimeo's player only loads
            for visitors who actually press play. */}
        <DemoVideo />
      </LobbyHero>
      </div>

      <div className="flex flex-col">
      {/* The Final · headline fixture */}
      {featured && (
        <>
          <SectionLabel icon={<Trophy size={13} />}>The Final</SectionLabel>
          <LobbyCard index={0}>
            <FinalCard fixture={featured} />
          </LobbyCard>
        </>
      )}

      {/* Results · finished matches (teaser + link to the full bracket) */}
      {finished.length > 0 && (
        <>
          <div className="mb-2.5 mt-9 flex items-center justify-between px-1">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-mut">
              <ShieldCheck size={13} />
              Results · verified on-chain
            </span>
            <span className="rounded-full bg-subtle px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ink2">
              {finished.length}
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            {latest.map((f, i) => (
              <LobbyCard key={f.id} index={i + 1}>
                <ResultCard fixture={f} />
              </LobbyCard>
            ))}
          </div>
          <LobbyCard index={latest.length + 1} className="mt-2.5">
            <Link
              href="/results"
              className="group flex items-center justify-center gap-2 rounded-[18px] border border-line bg-subtle py-3.5 text-[14px] font-semibold text-ink transition-colors hover:border-line2"
            >
              See all {finished.length} previous matches
              <ArrowRight size={16} className="transition-transform motion-safe:md:group-hover:translate-x-0.5" />
            </Link>
          </LobbyCard>
        </>
      )}
      </div>
    </main>
  );
}

function SectionLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-2.5 mt-9 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-mut">
      {icon}
      {children}
    </div>
  );
}

function Prob({ pct }: { pct: number | null }) {
  return <span className="tabular-nums text-ink">{pct != null ? `${Math.round(pct)}%` : "·"}</span>;
}

function FinalCard({ fixture }: { fixture: Fixture }) {
  const live = fixture.status === "live";
  return (
    <Link
      href={`/match/${fixture.id}`}
      // `isolate` scopes the ticker layer's negative z-index to THIS card: the
      // tickers paint above the card's own background but under every content
      // row (backgrounds and text), whatever structure the rows have.
      className="group relative isolate block overflow-hidden rounded-[22px] border border-line bg-surface p-5 shadow-card transition-colors hover:border-line2"
    >
      {/* ambient "money in the air": +$PROOF tickers rise over the card */}
      <FloatingWinnings />
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-mut">
          {fixture.competition} · {fixture.round}
        </span>
        {live ? (
          <span className="flex items-center gap-1.5 rounded-full border border-red/30 px-2.5 py-1 text-[10px] font-bold text-red">
            <span className="h-1.5 w-1.5 rounded-full bg-red animate-pulse2" />
            LIVE
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[10px] font-semibold text-mut">
            <Clock size={11} /> {kickoff(fixture.startTime)}
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center justify-center gap-5 text-[22px] font-bold text-ink">
        <span className="flex items-center gap-2">
          <Flag abbr={fixture.home.abbr} color={fixture.home.color} size={14} />
          {fixture.home.abbr}
        </span>
        <span className="text-[15px] font-medium text-faint">vs</span>
        <span className="flex items-center gap-2">
          {fixture.away.abbr}
          <Flag abbr={fixture.away.abbr} color={fixture.away.color} size={14} />
        </span>
      </div>

      {/* real de-margined win-probability */}
      {fixture.homeProb != null && (
        <div className="mt-4 flex items-center justify-between rounded-2xl bg-subtle px-4 py-2.5 text-[12px] font-medium text-mut">
          <span className="flex items-center gap-1.5">
            {fixture.home.abbr} <Prob pct={fixture.homeProb} />
          </span>
          <span className="flex items-center gap-1.5">
            Draw <Prob pct={fixture.drawProb} />
          </span>
          <span className="flex items-center gap-1.5">
            {fixture.away.abbr} <Prob pct={fixture.awayProb} />
          </span>
        </div>
      )}

      <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-ink py-3.5 text-[15px] font-semibold text-bg transition-transform group-active:scale-[0.985]">
        Open match
        <ArrowRight size={18} className="transition-transform motion-safe:md:group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

function ResultCard({ fixture }: { fixture: Fixture }) {
  const homeWon = fixture.winner === "home";
  const awayWon = fixture.winner === "away";
  return (
    <Link
      href={`/match/${fixture.id}`}
      className="group flex items-center gap-3 rounded-[18px] border border-line bg-surface px-4 py-3.5 shadow-soft transition-colors hover:border-line2"
    >
      <span className="w-16 shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-mut">
        {fixture.round}
      </span>
      <div className="flex flex-1 items-center justify-center gap-3 text-[15px] font-bold">
        <span className={`flex items-center gap-1.5 ${homeWon ? "text-ink" : "text-mut"}`}>
          <Flag abbr={fixture.home.abbr} color={fixture.home.color} />
          {fixture.home.abbr}
        </span>
        <span className="tabular-nums text-ink">
          {fixture.scoreH} : {fixture.scoreA}
        </span>
        <span className={`flex items-center gap-1.5 ${awayWon ? "text-ink" : "text-mut"}`}>
          {fixture.away.abbr}
          <Flag abbr={fixture.away.abbr} color={fixture.away.color} />
        </span>
      </div>
      <ChevronRight size={16} className="shrink-0 text-faint transition group-hover:text-mut motion-safe:md:group-hover:translate-x-0.5" />
    </Link>
  );
}
