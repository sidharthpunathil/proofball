# Where every number comes from

ProofBall shows **real World Cup data from the TxLINE (TxOdds) feed**, competition id **72**, on the
devnet API base `https://txline-dev.txodds.com/api`. Nothing shown as "live" is fabricated. This
document maps each on-screen value to its exact source.

## TL;DR

| On screen | Source | Notes |
| --- | --- | --- |
| Lobby odds % (ESP 42 / Draw 31 / ARG 27) | `GET /api/odds/snapshot/{fixtureId}` | de-margined 1X2 "StablePrice" |
| The needle % (e.g. "42% ESP TO WIN") | same odds feed, seeded on connect | real implied win-probability |
| All 30 knockout results (`/results`) | `GET /api/scores/snapshot/{fixtureId}` → **Postgres cache** | authoritative `game_finalised` row |
| Match event feed (goals, cards, corners) | same scores feed | real minutes + real actions |
| Team names, kick-off time | `GET /api/fixtures/snapshot?competitionId=72` | fixture directory |
| Finished-match needle (replay) | **modelled** from the real score + minute | a clearly-labelled *simulation*, see below |

## The fixtures

The **Final** is the featured/headline match, curated in `lib/txline-fixtures.ts` (`FEATURED_FIXTURE_ID`
`18257739`, Spain vs Argentina, kicks off Sun 19 Jul 2026 19:00 UTC).

Every **finished** match comes from the whole competition-72 knockout bracket , **30 matches**, Round of 32
through the Semi-finals:

| Round | Count | Examples |
| --- | --- | --- |
| Round of 32 | 16 | Spain 3:0 Austria, Brazil 2:1 Japan |
| Round of 16 | 8 | Portugal 0:1 Spain, USA 1:4 Belgium |
| Quarter-final | 4 | Argentina 3:1 Switzerland, France 2:0 Morocco |
| Semi-final | 2 | France 0:2 Spain, England 1:2 Argentina |

### How the bracket is discovered + stored

`scripts/sync-matches.mjs` (`npm run matches:sync`) pulls the full fixture directory, reads each fixture's
`scores/snapshot`, keeps the finished knockout fixtures (ids `>= 18000000`), derives the round from the
fixture's **position** in the kickoff-ordered bracket (16 → 8 → 4 → 2), and upserts them into the Postgres
`matches` table. The lobby and `/results` then read from Postgres (`lib/matches.ts`) instead of re-fetching
~30 endpoints on every page load. Re-run the sync any time; it's idempotent.

`getFixture(id)` (used by the match screen + stream route) resolves the curated Final first, then falls back
to the Postgres cache, so **any** finished match is playable with its real event log.

> **The group stage carries no score data on this devnet feed** (`scores/snapshot` is empty for those
> fixtures), so it is deliberately omitted. We never fabricate a scoreline , only knockout matches, which
> carry real results, are shown.

## Authentication (server-side only)

The browser never sees a token. The chain is:

1. `POST {origin}/auth/guest/start` returns a short-lived guest **JWT** (`lib/txline-auth.ts` -> `getGuestJwt`).
2. One-time, the **server wallet** subscribes on-chain (`subscribe`) and calls
   `POST /api/token/activate` with an ed25519 signature over `${txSig}:${leagues}:${jwt}`, which returns a
   long-lived **API token** (`scripts/txline-auth.ts`). One subscription serves the whole app.
3. `getCredentials()` returns `{ jwt, apiToken }`: it refreshes the guest JWT and reuses the stored
   `TXLINE_API_TOKEN` (cached about 20 minutes).

Every TxLINE request sends two headers: `Authorization: Bearer <jwt>` and `X-Api-Token: <apiToken>`.

## Endpoints used

- `GET /api/fixtures/snapshot?competitionId=72&startEpochDay=N`, fixture directory (team names, start times).
- `GET /api/odds/snapshot/{fixtureId}`, de-margined 1X2 odds. Bookmaker `TXLineStablePriceDemargined`,
  `SuperOddsType` `1X2_PARTICIPANT_RESULT`, `PriceNames` `["part1","draw","part2"]`, `Pct` = the implied
  win-probability after the bookmaker margin is removed. This IS the "true" probability the needle shows.
- `GET /api/scores/snapshot/{fixtureId}`, the ordered event log for a fixture.
- `GET /api/odds/stream`, `GET /api/scores/stream` (optional `?fixtureId=`), live SSE for in-running matches.

### Two schemas: snapshot vs stream

The **snapshot** endpoints return PascalCase records:

- `Score.Participant1.Total.Goals` / `Score.Participant2.Total.Goals`, the running score.
- `Clock.Seconds`, match clock (minute = `Seconds / 60`).
- `StatusId`, `100` means the match is finalised (authoritative full-time record).
- `Participant`, `1` = home, `2` = away.
- `Action`, `goal`, `corner`, `yellow_card`, `red_card`, `penalty`, `game_finalised`, and so on.

The **stream** endpoints use lowercase (`scoreSoccer`, `dataSoccer.Minutes`, `statusSoccerId`), normalised in
`lib/txline-live.ts`. Both are mapped into one internal `Frame` type (`lib/types.ts`).

## Honest note: the devnet publishes odds in windows

On this devnet feed, `odds/snapshot` is populated during publish windows and can be **empty between them**
(the scores/event logs are always present). So `lib/txline-fixtures.ts` keeps a small per-fixture cache of
the **most recent real de-margined price** and refreshes it whenever the feed is live. The seed value for the
Final (`{ home: 42.2, draw: 31.3, away: 26.6 }`) was captured directly from
`GET /api/odds/snapshot/18257739`. The probability shown is therefore always a real TxLINE price (the latest
observed), never a made-up number. When the feed is live, it updates automatically.

## Data flow

```
 Browser                         Next.js server (token stays here)         TxLINE API
 --------                        ---------------------------------         ----------
 EventSource(                    GET /api/txline/stream?fixtureId=id
   /api/txline/stream        ->    getFixture(id)                     ->   /fixtures/snapshot
   ?fixtureId=id)                  buildRealReplay(fixture)           ->   /scores/snapshot/{id}
        ^                          fetchOdds(id)                      ->   /odds/snapshot/{id}
        |  data: {kind:...}        (attach live stream if in-running) ->   /odds|scores/stream
        +---------------------- SSE frames (odds / clock / score) ----+
   zustand store (lib/store.ts) ingests frames -> needle, score, event feed
```

The lobby (`app/page.tsx`) server-renders the Final via `getFixtures()` and the finished results via
`getFinishedMatches()` (from the **Postgres** cache); `/results` lists all 30 grouped by round. The Final
shows the real odds %, each finished match its real score.

### Source selection (per fixture, most-real first)

`app/api/txline/stream/route.ts` picks the best available source and never shows a fake needle:

1. **Live** TxLINE odds+scores stream, for in-running fixtures.
2. **Real recorded feed**, the fixture's real event log + real odds, replayed via `buildRealReplay`.
3. **Captured `.ndjson`**, a file under `/fixtures` saved by `npm run record` during a live match.
4. **Synthetic sample**, the bundled arc in `lib/demo-fixture.ts`, a clearly-labelled last-resort fallback.

There is no user-facing replay/live toggle; the app always serves the most real data available and only
degrades on failure.

## Finished matches: the replay simulation

A finished match is **over**, so there is no live price to move the needle , the devnet emits a single real
odds frame for it and nothing after. To make a finished match playable, it is replayed as a **labelled
simulation**:

- The **scores and events are 100% real** (the fixture's recorded `scores/snapshot` log).
- The **needle is modelled**, not a real price. `simInPlayProbs(anchor, scoreH, scoreA, minute)` in
  `lib/winprob.ts` interpolates a plausible in-play 1X2 path from the **real running score + minute**,
  anchored on the real pre-match de-margined odds when we have them (else a neutral 40/30/30 tilt).
  `buildRealReplay` emits one modelled odds frame before each clock tick **only** when `fixture.status`
  is `"finished"`.
- The UI never hides this: the match screen shows *"▷ Replay"* in the header and a banner , *"This match is
  already over. You're playing the replay simulation. Calls only earn points."* Points earned go to the
  shared Redis leaderboard.

This preserves the honesty rule , a **live** match never shows a modelled needle (it uses the real feed);
only an explicitly-labelled replay of an already-decided match does, so nothing is ever passed off as a real
live price.

## Predictions and settlement

Users call whether the live win-probability will rise or fall. On lock, `/api/predict/lock` writes an
SPL-Memo commitment on Solana (fee-payer signs); results settle against the TxLINE data. "Provably fair"
means every settlement is checkable against on-chain-anchored TxLINE records.

## Reproduce it yourself

```bash
# guest JWT + your API token (interactive; needs a funded devnet FEE_PAYER_SECRET_KEY)
npm run txline:auth

# list the World Cup fixtures
curl -s "$TXLINE_API_BASE/fixtures/snapshot?competitionId=72&startEpochDay=<day>" \
  -H "Authorization: Bearer $JWT" -H "X-Api-Token: $TXLINE_API_TOKEN"

# real de-margined odds for the Final
curl -s "$TXLINE_API_BASE/odds/snapshot/18257739" \
  -H "Authorization: Bearer $JWT" -H "X-Api-Token: $TXLINE_API_TOKEN"
```
