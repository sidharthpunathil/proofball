import Link from "next/link";
import type { Fixture } from "@/lib/txline-fixtures";
import { ChevronRight } from "@/components/Icons";

/**
 * A finished-match result row: teams, real final score, winner emphasised.
 * Links into the match screen, which replays the fixture's real TxLINE event
 * log. Shared by the lobby and the /results page.
 */
export default function ResultCard({
  fixture,
  showRound = true,
}: {
  fixture: Fixture;
  showRound?: boolean;
}) {
  const homeWon = fixture.winner === "home";
  const awayWon = fixture.winner === "away";
  return (
    <Link
      href={`/match/${fixture.id}`}
      className="group flex items-center gap-3 rounded-[18px] border border-line bg-surface px-4 py-3.5 shadow-soft transition-colors hover:border-line2"
    >
      {showRound && (
        <span className="w-16 shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-mut">
          {fixture.round}
        </span>
      )}
      <div className="flex flex-1 items-center justify-center gap-3 text-[15px] font-bold">
        <span className={`flex items-center gap-1.5 ${homeWon ? "text-ink" : "text-mut"}`}>
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: fixture.home.color }} />
          {fixture.home.abbr}
        </span>
        <span className="tabular-nums text-ink">
          {fixture.scoreH} : {fixture.scoreA}
        </span>
        <span className={`flex items-center gap-1.5 ${awayWon ? "text-ink" : "text-mut"}`}>
          {fixture.away.abbr}
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: fixture.away.color }} />
        </span>
      </div>
      <ChevronRight size={16} className="shrink-0 text-faint transition group-hover:text-mut motion-safe:md:group-hover:translate-x-0.5" />
    </Link>
  );
}
