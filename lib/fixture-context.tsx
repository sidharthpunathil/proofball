"use client";

import { createContext, useContext } from "react";
import type { FixtureView } from "./types";
import { MATCH } from "./demo-fixture";

/** Default = the featured World Cup Final (Spain v Argentina). */
export const DEFAULT_FIXTURE: FixtureView = {
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

const FixtureContext = createContext<FixtureView>(DEFAULT_FIXTURE);

export const FixtureProvider = FixtureContext.Provider;

/** The fixture currently open on the match screen (teams, round, status). */
export function useFixture(): FixtureView {
  return useContext(FixtureContext);
}
