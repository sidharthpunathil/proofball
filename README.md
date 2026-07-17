<p align="center">
  <img src="public/proofball-logo.png" alt="ProofBall logo" width="140" />
</p>

<h1 align="center">ProofBall</h1>

**Momentum trading for your favorite sports.** Call the live win-probability of a match; every
result is settled against on-chain-anchored data, so the house can't cheat. Free to play. Built on
**TxLINE (TxOdds)** and **Solana**.

Headline: the app is wired to the **real TxLINE World Cup feed**. The featured match is the
**Spain vs Argentina final**, showing the real de-margined win-probability (about **Spain 42% / Draw 31% /
Argentina 27%**), and the lobby links to **all 30 finished knockout matches** with their real scores.

## The tournament (all real TxLINE data)

The whole knockout bracket is served , **30 finished matches** (Round of 32 → Round of 16 → Quarter-finals →
Semi-finals), each with its real scoreline. Browse them all on **`/results`** (grouped by round); the lobby
shows the latest few plus a "See all 30 previous matches" link.

| Round | Example | Result |
| --- | --- | --- |
| Semi-final | France vs Spain | 0 : 2 |
| Semi-final | England vs Argentina | 1 : 2 |
| Quarter-final | Argentina vs Switzerland | 3 : 1 |
| **Final** | **Spain vs Argentina** | Sun 19 Jul 2026, 19:00 UTC (upcoming) |

- **Open the Final** to see the live win-probability and make a real call.
- **Open a finished match** to replay its real event timeline (goals, cards, corners with real minutes). It
  is clearly marked *"This match is already over"* and plays as a **replay simulation**: you can still call
  the needle to earn leaderboard points, but nothing is at stake beyond the leaderboard.

> The **group stage** carries no score data on the devnet feed, so we never invent one , only the knockout
> matches (which carry real results) are shown.

## Quickstart

```bash
npm install
docker compose up -d   # Postgres (:55432) + Redis (:63799) , see "Data stores" below
npm run matches:sync   # populate the finished-match cache from the live TxLINE feed
npm run dev            # http://localhost:3000
```

The app degrades gracefully: with no `docker compose`, the DB/Redis calls fall back (fewer past matches, an
empty leaderboard until players connect) and the app still runs. To serve **real** TxLINE data, set
`TXLINE_API_TOKEN` (obtained via `npm run txline:auth`) in `.env.local`. See [`.env.example`](./.env.example).

## Data stores (multi-user)

State is split by what it is , see [docs/FLOW.md §3](./docs/FLOW.md) for the full map:

| What | Where | Why |
| --- | --- | --- |
| Finished-match **results** | **Postgres** (`docker` :55432), table `matches` | immutable results, cached once instead of re-fetched per load |
| Player **points** + the **global leaderboard** | **Redis** (`docker` :63799), ZSET `proofball:lb:coins` | shared across all users, persists across sessions, restored on sign-in |
| Shared **feed cache** (fixtures/odds) | **Redis** key `proofball:fixtures:v1` (60s) | many concurrent users share one upstream fetch of the rate-limited feed |
| Live **replay view** (needle, score, open call) | browser (zustand), ephemeral | it's just the view of the streamed replay |
| Prediction **commitment** | **Solana** memo via `/api/predict/lock` | provably-fair anchor |

Both containers come from [`docker-compose.yml`](./docker-compose.yml) on deliberately odd ports so they
never collide with a local Postgres (5432) or Redis (6379). Everything degrades gracefully if they're down.

## Is the data real?

Yes. Match data comes from the TxLINE API, competition id 72, on devnet:

- **Win-probability** = the de-margined 1X2 "StablePrice" from `odds/snapshot` (the true implied
  probability with the bookmaker margin removed).
- **Scores and events** = the real `scores/snapshot` event log; final scores come from the authoritative
  `game_finalised` record.
- There is **no replay/live toggle**: the app always serves the most real data available and only degrades to
  a clearly-labelled sample on failure.

One honesty caveat worth knowing: the devnet publishes odds in time-windows, so between windows the app shows
the **most recent real price** it captured (and refreshes when the feed is live). Full detail, including every
endpoint and schema, is in **[docs/DATA.md](./docs/DATA.md)**.

## Earning and the $PROOF token

Sign in with a Solana wallet (Phantom, Solflare, or Backpack); your public key is your
identity. A fresh wallet is airdropped **1,000 $PROOF** (a real devnet SPL token) so it can
play right away. Calls are pooled **parimutuel**: every entry goes into a round pool, and
the players who call the direction correctly split it in proportion to their stake. Create
the token once with `npm run token:create`.

Full detail, in plain terms and full technical, is in **[docs/EARN.md](./docs/EARN.md)**.
The product whitepaper is **[docs/WHITEPAPER.md](./docs/WHITEPAPER.md)**
(PDF: [`docs/ProofBall-Whitepaper.pdf`](./docs/ProofBall-Whitepaper.pdf)).

## How it works

```
Browser  --EventSource('/api/txline/stream?fixtureId=…')-->  Next.js server  --auth headers-->  TxLINE API
```

The browser opens a plain same-origin `EventSource`; the API token stays server-side. `MatchScreen` ingests
the SSE frames into a zustand store that drives the needle, score, and event feed. The lobby server-renders
the real fixtures.

## Tech stack

- **Next.js 15** (App Router) and **React 19**
- **zustand** for match/game state
- **framer-motion** for animation, **lucide-react** for icons
- **TxLINE** for odds and scores, **Solana** devnet for wallet sign-in (Wallet Standard: Phantom / Solflare / Backpack), the **$PROOF** reward token, and prediction commitments
- **Tailwind CSS**, light and dark themes
- **Vitest** for tests

## Scripts

| Command | What it does |
| --- | --- |
| `docker compose up -d` | start Postgres (:55432) + Redis (:63799) |
| `npm run matches:sync` | pull all finished knockout matches from TxLINE into Postgres (idempotent) |
| `npm run dev` | start the dev server |
| `npm test` | run the Vitest suite |
| `npm run txline:auth` | one-time on-chain subscribe + activate, prints your `TXLINE_API_TOKEN` |
| `npm run record <fixtureId>` | capture a live match to `fixtures/*.ndjson` for honest replay |
| `npm run token:create` | one-time: create the $PROOF devnet SPL mint (prints `NEXT_PUBLIC_PROOF_MINT`) |
| `npm run token:metadata` | one-time: attach name/symbol/logo (Metaplex metadata) so $PROOF shows as "ProofBall" in Phantom |

## Project layout

```
app/                    routes: / (lobby), /results, /match/[id], /api/txline/*, /api/predict/*,
                                /api/leaderboard, /api/og
components/             UI (MatchScreen, ProbabilityNeedle, PredictControl, MatchOver, ResultCard, ...)
lib/txline-fixtures.ts  real fixtures: getFixtures() (Redis-cached), buildRealReplay(), odds cache
lib/txline-live.ts      live TxLINE stream normalisation
lib/txline-auth.ts      guest JWT + API token (server-side)
lib/store.ts            zustand match/game state + shared-leaderboard sync
lib/db.ts               Postgres pool + schema (finished-match cache)
lib/matches.ts          read finished matches from Postgres (getFinishedMatches, getDbMatch)
lib/redis.ts            Redis client + JSON cache helpers (graceful)
lib/leaderboard.ts      global leaderboard (Redis ZSET): submitScore, topLeaders, getUserScore
lib/economy.ts          the $PROOF economy in one file (airdrop, entry, rake)
lib/token.ts            server-side $PROOF SPL helpers (mint authority = fee-payer)
lib/pool.ts             parimutuel pool settlement (settlePool), tested in tests/pool.test.ts
scripts/create-token.ts one-time $PROOF mint creation (npm run token:create)
scripts/set-token-metadata.ts  attach name/symbol/logo to the mint (npm run token:metadata)
docs/EARN.md            earning + $PROOF + the pool, plain and technical
docs/WHITEPAPER.md      the product whitepaper (PDF: docs/ProofBall-Whitepaper.pdf)
lib/teams.ts            nation abbr + colour metadata for the full field
lib/winprob.ts          odds→prob, plus simInPlayProbs() for the finished-match replay simulation
scripts/sync-matches.mjs  TxLINE → Postgres sync (npm run matches:sync)
docker-compose.yml      Postgres + Redis (odd ports 55432 / 63799)
docs/DATA.md            where every on-screen number comes from
docs/FLOW.md            data flow, storage map, environment
```
