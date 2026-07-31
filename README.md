<p align="center">
  <img src="public/proofball-logo.png" alt="ProofBall logo" width="140" />
</p>

# ProofBall

**Momentum trading for your favorite sports — call the live win-probability needle, provably fair, free to play**

A second-screen game for the World Cup built on the real **TxLINE (TxOdds)** data feed and **Solana**. Predict which way a match's live win-probability swings; calls are pooled parimutuel with a 0% house rake and every result is settled against on-chain-anchored data, so the house can't cheat.

[![Live Demo](https://img.shields.io/badge/demo-proofball.xyz-brightgreen)](https://proofball.xyz)
[![Solana Devnet](https://img.shields.io/badge/Solana-Devnet-9945FF)](https://explorer.solana.com/?cluster=devnet)
[![TxLINE Data](https://img.shields.io/badge/data-TxLINE-0a7f5b)](https://proofball.xyz/how-it-works)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)

---

## Why ProofBall?

| Traditional sports betting | With ProofBall |
|----------------------------|----------------|
| House sets the odds and keeps a margin | Parimutuel pools — winners split the pot, **0% rake** |
| Settlement is opaque | Settled against **on-chain-anchored TxLINE data** |
| Deposit real money to play | Free — fresh wallets are airdropped **1,000 $PROOF** |
| Pre-match bets only | Call the **live needle** at any minute of the match |

---

## Features

| Feature | Description |
|---------|-------------|
| **Live win-probability needle** | De-margined 1X2 "StablePrice" from TxLINE, streamed to the browser over SSE |
| **Call the momentum** | Predict which way the needle swings; calls are pooled parimutuel and committed on-chain (Solana memo) as a provably-fair anchor |
| **$PROOF token economy** | Real devnet SPL token; welcome airdrop of 1,000 $PROOF with an auditable ledger |
| **30 real finished matches** | The full knockout bracket with real scores and event timelines, replayable at `?speed=` 1/2/5/10× |
| **Global leaderboard** | Redis-backed, shared across all players; calls persist per wallet with the match minute |
| **Desktop and mobile wallets** | Phantom / Solflare / Backpack via Wallet Standard, MWA on Android, deeplinks on iOS |
| **Shareable moments** | OG earnings cards (`/api/og`) and `/call` unfurl permalinks |
| **Feels alive** | Zero-asset Web Audio sound engine, framer-motion micro-interactions, light and dark themes |

---

## Live Demo

**[https://proofball.xyz](https://proofball.xyz)**

1. Sign in with a Solana wallet (Phantom, Solflare, or Backpack) — your public key is your identity
2. A fresh wallet is airdropped **1,000 $PROOF** so it can play right away
3. Open the **Spain vs Argentina final** to see the live win-probability and make a real call
4. Open any **finished match** to replay its real event timeline and call the needle for leaderboard points

---

## The Tournament (all real TxLINE data)

The whole knockout bracket is served — **30 finished matches** (Round of 32 → Semi-finals), each with its real scoreline, browsable on [`/results`](https://proofball.xyz/results):

| Round | Match | Result |
|-------|-------|:------:|
| Semi-final | 🇫🇷 France vs 🇪🇸 Spain | 0 : 2 |
| Semi-final | 🏴󠁧󠁢󠁥󠁮󠁧󠁿 England vs 🇦🇷 Argentina | 1 : 2 |
| Quarter-final | 🇦🇷 Argentina vs 🇨🇭 Switzerland | 3 : 1 |
| **Final** | 🇪🇸 **Spain vs Argentina** 🇦🇷 | Sun 19 Jul 2026, 19:00 UTC |

> [!NOTE]
> The group stage carries no score data on the devnet feed, so we never invent one — only the knockout matches (which carry real results) are shown. Finished matches are clearly marked *"This match is already over"* and play as honest replay simulations.

---

## Quick Start

```bash
npm install
docker compose up -d   # Postgres (:55432) + Redis (:63799)
npm run matches:sync   # populate the finished-match cache from the live TxLINE feed
npm run dev            # http://localhost:3000
```

> [!IMPORTANT]
> To serve **real** TxLINE data, set `TXLINE_API_TOKEN` (obtained via `npm run txline:auth`) in `.env.local`. See [`.env.example`](./.env.example) for every variable. Without `docker compose` the app degrades gracefully — nothing hard-crashes when a store is down.

---

## How It Works

- **Win-probability** = the de-margined 1X2 "StablePrice" from `odds/snapshot` — the true implied probability with the bookmaker margin removed
- **Scores and events** = the real `scores/snapshot` event log; final scores come from the authoritative `game_finalised` record
- **Data path**: the browser opens a plain same-origin `EventSource` to the Next.js server, which talks to the TxLINE API — the token never leaves the server
- **No replay/live toggle**: the app always serves the most real data available and only degrades to a clearly-labelled sample on failure
- Calls are pooled **parimutuel**: every entry joins a round pool and the players who call the direction correctly split it in proportion to their stake — the house takes nothing

For the plain-words version with animated charts, see [`/how-it-works`](https://proofball.xyz/how-it-works). Every endpoint and schema is documented in [docs/DATA.md](./docs/DATA.md).

---

## Data Stores

| What | Where | Why |
|------|-------|-----|
| Finished-match **results** | **Postgres** (`:55432`), table `matches` | Immutable results, cached once |
| Player **calls** | **Postgres**, table `picks` via `/api/picks` | Per-wallet history that survives any device |
| **Points** + global **leaderboard** | **Redis** (`:63799`), ZSET | Shared across all users, restored on sign-in |
| Shared **feed cache** | **Redis** (60s fixtures + durable replays) | One upstream fetch of the rate-limited feed |
| Live **replay view** | Browser (zustand), ephemeral | It's just the view of the streamed replay |
| Prediction **commitment** | **Solana** memo via `/api/predict/lock` | Provably-fair anchor |

---

## Project Structure

```
proofball/
├── app/                  # Routes: lobby, /match/[id], /results, /how-it-works, /call, /whitepaper
│   └── api/              # txline/* (SSE stream), predict/lock, picks, leaderboard, og, admin
├── components/           # MatchScreen, ProbabilityNeedle, PredictControl, ShareButton, …
├── lib/                  # zustand store, TxLINE clients, $PROOF economy, pool math, sound engine
├── scripts/              # Token creation, TxLINE auth, match sync/warm, airdrop ledger
├── docs/                 # DATA, EARN, FLOW, WHITEPAPER, SECURITY-AUDIT
├── tests/                # Vitest suite (pool settlement math)
└── docker-compose.yml    # Postgres + Redis on deliberately odd ports (55432 / 63799)
```

---

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the dev server |
| `npm test` | Run the Vitest suite |
| `npm run matches:sync` | Pull all finished knockout matches from TxLINE into Postgres (idempotent) |
| `npm run matches:warm` | Pre-warm the durable replay cache |
| `npm run txline:auth` | One-time on-chain subscribe + activate, prints your `TXLINE_API_TOKEN` |
| `npm run token:create` | One-time: create the $PROOF devnet SPL mint |
| `npm run token:metadata` | One-time: attach name/symbol/logo (Metaplex) so $PROOF shows in Phantom |
| `npm run airdrops` | Print the welcome-airdrop audit ledger |

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 15 (App Router), React 19 |
| State & Motion | zustand, framer-motion (LazyMotion) |
| Styling | Tailwind CSS, light and dark themes |
| Blockchain | Solana (Devnet) — wallet sign-in, $PROOF SPL token, memo commitments |
| Data | TxLINE (TxOdds) live odds + scores feed |
| Storage | Postgres (results, picks), Redis (leaderboard, feed cache) |
| Testing | Vitest |

---

## Documentation

| Doc | Contents |
|-----|----------|
| [docs/DATA.md](./docs/DATA.md) | Where every on-screen number comes from (endpoints + schemas) |
| [docs/EARN.md](./docs/EARN.md) | Earning, $PROOF, and the pool — plain and technical |
| [docs/FLOW.md](./docs/FLOW.md) | Data flow, storage map, environment |
| [docs/WHITEPAPER.md](./docs/WHITEPAPER.md) | The product whitepaper ([PDF](./docs/ProofBall-Whitepaper.pdf)) |
| [docs/SECURITY-AUDIT.md](./docs/SECURITY-AUDIT.md) | Full-app security audit |

---

## Hackathon Submission

Built for the [World Cup Hackathon](https://superteam.fun/earn/listing/consumer-and-fan-experiences) by Superteam Earn, powered by TxODDS.

**Deliverables:**
- Live demo at [proofball.xyz](https://proofball.xyz) on the real TxLINE World Cup feed
- 30 real finished knockout matches, each replayable with its true event timeline
- $PROOF devnet SPL token economy with audited welcome airdrops
- Parimutuel pool engine with 0% house rake (tested settlement math)
- Product whitepaper + full data/flow/security documentation
- Desktop and mobile wallet support (Wallet Standard, MWA, deeplinks)

---

## Author

**Sidharth P** — [GitHub](https://github.com/sidharthpunathil)
