import type { Metadata } from "next";
import MatchScreen from "@/components/MatchScreen";
import { getFixture, FEATURED_FIXTURE_ID } from "@/lib/txline-fixtures";
import { MATCH } from "@/lib/demo-fixture";
import type { FixtureView } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const fixtureId = id === "featured" ? FEATURED_FIXTURE_ID : id;
  const fixture = (await getFixture(fixtureId)) ?? FALLBACK;

  const matchup = `${fixture.home.name} vs ${fixture.away.name}`;
  const stage = [fixture.competition, fixture.round].filter(Boolean).join(" ");
  const description = `Call the live win-probability as ${fixture.home.name} face ${fixture.away.name}${
    stage ? ` in the ${stage}` : ""
  }. Every result settled against on-chain data on ProofBall.`;

  return {
    title: matchup,
    description,
    alternates: { canonical: `/match/${id}` },
    openGraph: {
      title: `${matchup} · ProofBall`,
      description,
      url: `/match/${id}`,
    },
    twitter: {
      title: `${matchup} · ProofBall`,
      description,
    },
  };
}

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
