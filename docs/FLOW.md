# ProofBall, Data Flow, Storage & Environment

This documents **how data moves through ProofBall**, **where every piece of data is stored** (and for how long), and **every environment variable**. It covers both the current scaffold (demo/replay) and the production (live) design.

---

## 1. The big picture

```
                 ┌──────────────────────────── BROWSER (client) ───────────────────────────┐
                 │  React + zustand (in-memory, ephemeral)                                  │
                 │  • EventSource('/api/txline/stream')  ← same-origin, cookie only         │
                 │  • win-prob needle · prediction card · streak · leaderboard · verify link│
                 └───────▲──────────────────────────────┬──────────────────────┬───────────┘
                         │ SSE frames                   │ POST /predict/lock    │ GET/POST /leaderboard
                         │                              │                       │
        ┌────────────────┴──────────────────────────────▼───────────────────────▼──────────────────┐
        │                              NEXT.JS SERVER (Vercel)                                       │
        │  /api/txline/stream   live TxLINE SSE, else buildRealReplay (finished = sim needle) → SSE  │
        │  /api/predict/lock    hash(match|market|wallet|pick|prob|ts|salt) → SPL-Memo commitment    │
        │  /api/leaderboard     GET top players · POST submit                → Redis                 │
        │  getFixtures()/matches  finished results from Postgres · shared 60s feed cache in Redis     │
        └──────┬──────────────────────────┬───────────────────────┬──────────────────────┬──────────┘
               │                          │ (live only)            │ (live only)          │
     ┌─────────▼──────────────┐ ┌─────────▼──────────────┐ ┌───────▼──────────────┐ ┌─────▼──────────────┐
     │  DATA STORES (docker)  │ │  TxLINE (devnet)       │ │  Solana (devnet)     │ │  (fee-payer key    │
     │  Postgres :55432       │ │  auth · subscribe ·    │ │  txoracle subscribe/ │ │   env, server)     │
     │   matches (results)    │ │  activate · odds/      │ │  validate · roots    │ └────────────────────┘
     │  Redis :63799          │ │  scores · SSE · proofs │ │  SPL-Memo (commits)  │
     │   leaderboard + cache  │ └────────────────────────┘ └──────────────────────┘
     └────────────────────────┘
```

**Golden rule:** the browser never holds a TxLINE API token, a Solana secret key, or a DB/Redis credential. All secrets and stores stay server-side. The client only ever talks to same-origin `/api/*` routes.

---

## 2. Runtime flow, step by step

### A. Boot & sign-in
1. Browser loads `/match/featured` → `MatchScreen` mounts.
2. `MatchScreen` opens a same-origin `EventSource('/api/txline/stream')`. No headers, no token, just the session cookie.
3. `SignInGate` overlays. One tap:
   - **Demo:** `store.signIn(name)` creates an in-memory user + a fake wallet string.
   - **Live:** Privy email/passkey login → auto-creates an embedded Solana wallet → server runs `subscribe` + `activate` (see §2E) → API token stored in the **server session**.
   - On sign-in the store also `restoreScore(name)`: it `GET`s `/api/leaderboard?name=` and restores the player's stored coins/streak from Redis (monotonic , you never lose points), so points survive refresh and follow you across sessions.

### B. Live data in
4. The stream route emits `data: {kind:"odds"|"score"|"clock", ...}` frames.
   - **Demo:** `buildReplay()` (`lib/demo-fixture.ts`) yields the sample arc, paced with delays, looped.
   - **Live:** the route `fetch()`es TxLINE's `/api/odds/stream` (+ `/scores/stream`) with `Authorization: Bearer <jwt>` + `X-Api-Token`, normalizes each `OddsPayload`/`Scores` into a `Frame`, and re-streams it.
5. `store.ingest(frame)` updates `winProbHome` (from `Pct`), score, minute, and the event feed. The needle animates.

### C. The prediction loop (client-driven timers in `MatchScreen`)
6. Every 3.5s with no open market → `store.openMarket()` creates a market with a 7s lock timer.
7. User taps ▲/▼ → `store.setPick(dir)`.
8. At `lockAt`: `store.lockMarket()` freezes `lockedProb = current winProbHome`; the client `POST`s `/api/predict/lock`.
9. `/api/predict/lock` builds a **commitment hash** (`lib/commit.ts`) and returns `{ memoSig, verifyUrl }`. `store.attachProof()` attaches them.
10. At `settleAt` (7s later): `store.settleMarket()` compares the new `winProbHome` to `lockedProb`, decides win/loss, updates coins + streak, and moves the pick to history with its verify link. It also `postScore()`s the new total to Redis, and the Board tab polls `syncLeaderboard()` every 5s , so **every player sees the same global ranking**.

### C′. Finished matches = a replay simulation
A finished match (opened from `/results` or the lobby) runs the **same** prediction loop, but it is framed as a simulation: the match is already over, so the header shows *"▷ Replay"* and a banner reads *"This match is already over. You're playing the replay simulation. Calls only earn points."* Because the devnet emits no live price for a finished match, the needle is **modelled** from the real running score + minute (`simInPlayProbs`, see [DATA.md](./DATA.md#finished-matches-the-replay-simulation)) so it actually moves and can be called. Scores/events stay real; points still persist to the Redis leaderboard.

### D. Verify (the moat)
11. Each settled pick shows a **"⛓ verify"** link.
    - **Demo:** links the persistent on-chain `txoracle` root account on the Solana explorer.
    - **Live:** links the confirmed SPL-Memo commitment tx, and/or runs `txoracle.validate_stat_v2(...).view()` to recompute the Merkle proof against the on-chain root (free, read-only) and shows "✓ verified".

### E. The live auth chain (server, one-time per user, live mode only)
```
POST /auth/guest/start                     → guest JWT (30-day)
txoracle.subscribe(1, 4)  [devnet, 0 TxL]  → txSig   (fee-payer co-signs the gas)
sign ed25519 over `${txSig}::${jwt}`       → walletSignature
POST /api/token/activate {txSig, sig, []}  → API token (X-Api-Token)
```
See `../ProofBall.md` §4–§5 for exact accounts, program IDs, and the signature preimage.

---

## 3. Where data is stored (this is the "db / location" answer)

### 3.1 What's stored where
State is split by durability and sharing. Durable/shared state lives in **Postgres + Redis** (docker), ephemeral view state lives in the **browser**, and provably-fair anchors live on **Solana**. The app degrades gracefully , if the stores are down it falls back to fewer past matches + an empty leaderboard, so nothing hard-fails. The leaderboard is **real players only** , no seed/demo rows; it shows whoever has connected and made a call.

| Data | Stored in | Location | Lifetime | Shared across users? |
|---|---|---|---|---|
| **Finished-match results** | **Postgres** `matches` table | docker :55432 , `lib/db.ts`, `lib/matches.ts` | until re-sync (immutable) | yes (read) |
| **Player coins + streak, global leaderboard** | **Redis** ZSET `proofball:lb:coins` + hash `proofball:lb:streak` | docker :63799 , `lib/leaderboard.ts` | persistent | **yes** |
| **Shared feed cache** (fixtures/odds) | **Redis** `proofball:fixtures:v1` | docker :63799 , `lib/redis.ts` | 60s TTL | yes |
| Live match/replay view (needle, score, events, open call) | zustand, browser memory | `lib/store.ts` | until page refresh | no |
| User session (demo) | zustand (client) | `lib/store.ts` | until refresh | no |
| Predictions / commitments | zustand `history[]` (client) + a hash computed server-side per request (not persisted) | `lib/store.ts`, `app/api/predict/lock` | client until refresh; hash not persisted | no |
| **Sample match feed** (last-resort fallback) | a committed file in the bundle | `lib/demo-fixture.ts` (`buildReplay()`) | permanent | n/a |
| TxLINE tokens (live) | server session cookie / env | `lib/txline-auth.ts` | session TTL | no |
| Fee-payer key (live) | server env var | `FEE_PAYER_SECRET_KEY` | deploy lifetime | no |

So: **durable/shared data → Postgres + Redis (server-side docker, odd ports 55432 / 63799); ephemeral view state → browser; commitments + proofs → Solana.** No secret or store credential ever reaches the client.

### 3.2 What lives **on-chain** (Solana devnet)
| Data | Where | Written by |
|---|---|---|
| Subscription entitlement | `txoracle` program state (via `subscribe`) | user wallet (fee-payer co-signs) |
| Pick commitment hash | SPL-Memo tx (live) | server fee-payer |
| Match result Merkle roots | `daily_scores_roots` PDA etc. | **TxODDS** (you only read/verify) |

### 3.3 Persistence: implemented vs. next
The demo now ships the first two rows below (they were the original recommendation). The rest is the roadmap when you outgrow it.

| Store | Use it for | Status |
|---|---|---|
| **Postgres** (docker; swap for Supabase / Neon / Vercel Postgres in prod) | finished-match results (`matches`); later: users, predictions, coin ledger | **implemented** (results) |
| **Redis** (docker; swap for Upstash / Vercel KV in prod) | global leaderboard (ZSET), shared feed cache; later: rate limits, active-market cache | **implemented** (leaderboard + cache) |
| **Object storage** (Vercel Blob / S3) | recorded TxLINE match feeds (`.ndjson`) for replay | future |
| **On-chain (Solana)** | pick commitments + settlement proofs (source of "provably fair") | implemented (commitments) |

What's live today:
```
Postgres  matches(fixture_id PK, competition, round, round_rank, home_name, home_id,
                  away_name, away_id, start_time, score_h, score_a, winner, finished, synced_at)
Redis     proofball:lb:coins    ZSET  member=name  score=coins   (global leaderboard)
          proofball:lb:streak   HASH  name → streak
          proofball:fixtures:v1 STRING JSON, 60s TTL             (shared feed cache)
```

Roadmap tables (Postgres), when you add cross-device accounts + a durable coin ledger:
```
users(id, wallet_pubkey, handle, created_at)
predictions(id, user_id, fixture_id, market_id, dir, locked_prob, lock_ts,
            commitment_hash, memo_sig, status, delta, reward, settled_at)
ledger(id, user_id, delta_coins, reason, ref_prediction_id, created_at)
recorded_feeds(fixture_id, storage_url, recorded_at, event_count)
```
Keep **money/coins off-chain** (free-to-play ledger, today in Redis). Keep **commitments + settlement proofs on-chain**. That split is what makes the product both fast and provably fair.

---

## 4. Environment & secrets

### 4.1 Which file is loaded when (Next.js convention)
| File | Loaded in | Committed? | Purpose |
|---|---|---|---|
| `.env` | all environments | **no** (gitignored) | dev defaults (replay, public config) |
| `.env.local` | all except test; overrides `.env` | **no** | your personal secrets in dev |
| `.env.production` | `next build` / `next start` | **no** (gitignored) | prod template; prefer Vercel dashboard |
| `.env.example` |, | **yes** | reference for dev vars |
| `.env.production.example` |, | **yes** | reference for prod vars |

On **Vercel**, don't rely on `.env.production`, set each variable in **Project → Settings → Environment Variables** (they're injected at build/runtime and encrypted).

### 4.2 Every variable
**Public (safe on client, `NEXT_PUBLIC_` prefix):**
| Var | Meaning |
|---|---|
| `NEXT_PUBLIC_SOLANA_CLUSTER` | `devnet` (allowed by the hackathon) |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy app id for the embedded wallet |

**Server-only (NEVER `NEXT_PUBLIC_`, never sent to the browser):**
| Var | Meaning | Where it lives |
|---|---|---|
| `DEMO_MODE` | `replay` (default) or `live` | env |
| `TXLINE_API_BASE` | `https://txline-dev.txodds.com/api` | env |
| `TXLINE_AUTH_URL` | guest JWT endpoint | env |
| `TXLINE_GUEST_JWT` | 30-day guest JWT (usually obtained at runtime) | env / session |
| `TXLINE_API_TOKEN` | activated API token (usually per-user in session) | env / session |
| `TXLINE_FIXTURE_ID` | which fixture to stream live | env |
| `WORLDCUP_COMPETITION_ID` | `72` | env |
| `SOLANA_RPC_URL` | devnet RPC (Helius recommended) | env |
| `FEE_PAYER_SECRET_KEY` | base58 devnet keypair, pays gas, writes memos | **secret** |
| `TXORACLE_PROGRAM_ID` | `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J` | env |
| `TXL_MINT` | `4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG` | env |
| `SESSION_SECRET` | signs the session cookie holding the API token | **secret** |
| `DATABASE_URL` | Postgres for the finished-match cache; defaults to the docker instance on `:55432` | env |
| `REDIS_URL` | Redis for the leaderboard + shared feed cache; defaults to the docker instance on `:63799` | env |

Both `DATABASE_URL` and `REDIS_URL` have safe localhost defaults baked into `lib/db.ts` / `lib/redis.ts`, so `docker compose up -d` is enough for local dev , no `.env` edit needed. In prod, point them at managed instances (Neon/Supabase, Upstash/Vercel KV).

### 4.3 Secret-handling rules
- Secrets live **only** on the server (env vars / Vercel) and are read only by route handlers.
- The per-user TxLINE API token is stored in a **signed session cookie**, never exposed to client JS.
- `FEE_PAYER_SECRET_KEY` is a **throwaway devnet key**, still never commit it (`_keys/` and `.env*` are gitignored).
- Rotate `SESSION_SECRET` and the fee-payer key if they ever leak.

---

## 5. File map (where each thing lives in the repo)

| Concern | File |
|---|---|
| App state / prediction logic / leaderboard sync | `lib/store.ts` |
| Payload types (TxLINE-shaped) | `lib/types.ts` |
| Win-probability from `Pct` + `simInPlayProbs()` (sim needle) | `lib/winprob.ts` |
| Real fixtures + replay builder (Redis-cached) | `lib/txline-fixtures.ts` |
| **Sample replay feed** (last-resort fallback) | `lib/demo-fixture.ts` |
| On-chain commitment hashing | `lib/commit.ts` |
| Postgres pool + schema | `lib/db.ts` |
| Read finished matches from Postgres | `lib/matches.ts` |
| Redis client + JSON cache helpers | `lib/redis.ts` |
| Global leaderboard (Redis ZSET) | `lib/leaderboard.ts` |
| Nation abbr + colour metadata | `lib/teams.ts` |
| SSE proxy (live + finished-match sim replay) | `app/api/txline/stream/route.ts` |
| Prediction commitment endpoint | `app/api/predict/lock/route.ts` |
| Leaderboard API (GET top / POST submit) | `app/api/leaderboard/route.ts` |
| "I called it" share card | `app/api/og/route.tsx` |
| Lobby + results pages | `app/page.tsx`, `app/results/page.tsx` |
| Privy provider (embedded wallet) | `app/providers.tsx` |
| Server TxLINE auth (guest JWT + activate) | `lib/txline-auth.ts` |
| Live odds/scores normalizer | `lib/txline-live.ts` |
| Recorded-feed loader | `lib/recorded.ts` |
| Sync finished matches → Postgres | `scripts/sync-matches.mjs` |
| One-time on-chain subscribe + record scripts | `scripts/txline-auth.ts`, `scripts/record.ts` |
| Screen orchestrator (SSE + timers) | `components/MatchScreen.tsx` |
| Win-prob gauge | `components/ProbabilityNeedle.tsx` |
| Prediction UI / "already over" sim banner | `components/PredictControl.tsx`, `components/MatchOver.tsx` |
| Result row + leaderboard | `components/ResultCard.tsx`, `components/Leaderboard.tsx` |
| Sign-in (Privy mount point) | `components/SignInGate.tsx` |
| Postgres + Redis (docker) | `docker-compose.yml` |
| Tests | `tests/*.test.ts` |
| Env | `.env`, `.env.production`, `*.example` |
| This doc | `docs/FLOW.md` |

---

## 6. Swapping in real TxLINE data (required before submitting)

1. During a live World Cup match, record the real SSE stream to `fixtures/worldcup-<match>.ndjson` (one JSON event per line, with timestamps).
2. Point `buildReplay()` (or a new `loadRecorded()`) at that file, or set `DEMO_MODE=live` with a real `TXLINE_FIXTURE_ID` so the proxy streams live.
3. Nothing downstream changes, the needle, predictions, settlement, and verify links all read the same `Frame` shape.

This keeps the demo **honest**: you're replaying *real captured* data, not fabricating it.
