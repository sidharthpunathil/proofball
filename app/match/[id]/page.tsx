import MatchScreen from "@/components/MatchScreen";
import { getFixture, FEATURED_FIXTURE_ID } from "@/lib/txline-fixtures";
import { MATCH } from "@/lib/demo-fixture";
import type { FixtureView } from "@/lib/types";

export const dynamic = "force-dynamic";

// Fallback identity if the fixtures API is briefly unreachable, the featured Final.
const FALLBACK: FixtureView = {
  id: MATCH.id,
  round: "Final",
  competition: "World Cup",
  home: { name: MATCH.home, abbr: MATCH.homeAbbr, color: MATCH.homeColor },
  away: { name: MATCH.away, abbr: MATCH.awayAbbr, color: MATCH.awayColor },
  startTime: 0,
  status: "upcoming",
  scoreH: null,
  scoreA: null,
  winner: null,
  homeProb: null,
  drawProb: null,
  awayProb: null,
};

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fixtureId = id === "featured" ? FEATURED_FIXTURE_ID : id;
  const fixture = (await getFixture(fixtureId)) ?? FALLBACK;
  return <MatchScreen fixture={fixture} />;
}
