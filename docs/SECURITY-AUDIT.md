# ProofBall — Security Audit

_Scope: the ProofBall Next.js 15 + Solana (devnet) app. Audit performed with
[`vercel-labs/deepsec`](https://github.com/vercel-labs/deepsec) (regex candidate scan) plus a
four-agent deep review (money/authz, auth/secrets, injection/SSRF/XSS, config/infra/deps). Every
finding below was verified against source, not just pattern-matched._

## Executive summary

The app has **no server-side authentication**. `@privy-io/react-auth` was in `package.json` but was
**imported nowhere**; `SESSION_SECRET` / `PRIVY_*` env vars were referenced by no code. Identity is
purely client-side (a Solana wallet pubkey), and every mutating API route trusted client-supplied
identity. That single gap is the root cause of the top findings.

Because everything runs on **devnet** ($PROOF and the fee-payer's SOL have no cash value), real
monetary impact today is limited to griefing/DoS and demo integrity — but the same code becomes a
real-money mint + fund drain the moment it points at mainnet.

deepsec's raw regex counts were mostly **false positives** on manual review: SQL injection — none
(all queries parameterized), XSS — none (OG route rasterizes to PNG; theme script is a static
constant), weak-crypto — none (CSPRNG used, zero `Math.random`), RCE — none (Redis `EVAL` uses a
static Lua literal with the wallet passed as `ARGV[1]`). The genuine risk is **authorization and
rate-limiting**, not injection.

## Findings & status

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| 1 | Critical (on mainnet) / High (devnet) | Unauthenticated airdrop mint → Sybil farming + fee-payer SOL drain | **Mitigated** (rate limits + global mint budget); **SIWS root fix implemented behind `AUTH_REQUIRED`** (off by default) |
| 2 | High | No server-side identity verification; routes trust spoofable body fields | **Mitigated** + SIWS available (flag-gated); enable in production |
| 3 | High | Leaderboard: unauthenticated arbitrary/negative/huge score write + overwrite (IDOR) | **Mitigated** (clamp + rate limit); **SIWS identity binding behind `AUTH_REQUIRED`** |
| 4 | High→resolved | Dependency vulnerabilities (72; 1 critical, 12 high) | **Reduced to 43 (0 critical, 7 high)**; remainder dev-only / transitive |
| 5 | Medium | No rate limiting anywhere + unbounded SSE loop | **Fixed** (Redis limiter on airdrop/leaderboard/lock) |
| 6 | Medium | Coin/reward economy is client-authoritative | Documented (needs server-authoritative settlement) |
| 7 | Medium | "Provably-fair" commit is cosmetic (salt discarded, never revealed) | Documented |
| 8 | Medium | Secrets (API token / JWT) printed to stdout in helper scripts | **Fixed** (write to `0600` gitignored file + masked preview) |
| 9 | Medium | Missing HTTP security headers | **Fixed** (added; CSP tracked as follow-up) |
| 10 | Medium | docker-compose: Redis no auth, weak Postgres creds, `0.0.0.0` binding | **Fixed** (loopback bind + env-configurable creds/auth) |
| 11 | Low | Latent SSRF via unvalidated `fixtureId` in credentialed upstream fetch | **Fixed** (numeric validation + encoding) |
| 12 | Low | `settlePool` math: no stake validation, div-by-zero, non-conserving rounding | **Fixed** (validation + pool conservation) |
| 13 | Low | Dead `@privy-io/react-auth` dep + unused auth env (false sense of security) | **Fixed** (removed dep) |

## What was fixed in this pass

- **Rate limiting** — new Redis fixed-window limiter (`lib/redis.ts` `rateLimit`/`clientIp`), wired into:
  - `POST /api/reward/airdrop`: 5/hour per IP + a **global 300/hour mint-budget ceiling** (bounds
    fee-payer SOL burn even across many IPs; the slot is released on a paused mint so real users can
    still claim later).
  - `POST /api/leaderboard`: 30/min per IP.
  - `POST /api/predict/lock`: 60/min per IP.
- **Leaderboard input hardening** — `coins`/`streak` clamped to non-negative integers within a sane
  ceiling, so forged negative / huge / `NaN` values can't poison the shared ZSET.
- **`settlePool` hardening** — sanitizes non-finite/negative stakes to 0, guards div-by-zero
  (`winStake <= 0` → refund all), and hands the last winner the exact remainder so `Σ winner payouts`
  equals the distributable pool to the cent (prevents insolvency if ever wired on-chain).
- **SSRF defense-in-depth** — `fixtureId` must match `^[0-9]{1,12}$` before it can reach a
  credentialed TxLINE URL, and it's URL-encoded.
- **Secret hygiene** — `scripts/txline-auth.ts` and `scripts/activate.ts` no longer print full
  tokens/JWTs; they write ready-to-paste env lines to `.env.txline.local` (`chmod 600`, gitignored)
  and print only a masked preview.
- **HTTP security headers** — `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy`, `Strict-Transport-Security`, `Permissions-Policy` on all routes.
- **docker-compose** — Postgres/Redis bound to `127.0.0.1` (were on `0.0.0.0`); Postgres password and
  optional Redis `--requirepass` now come from env (defaults preserve local-dev behavior).
- **Dependencies** — removed the unused `@privy-io/react-auth` (root of the entire vulnerable
  WalletConnect/Reown/wagmi/viem/x402 subtree) and bumped `vitest` to v3 (killed the one critical).
  **72 → 43 vulns, 1 critical → 0.** All 35 tests still pass; production build is clean.

## Sign-In-With-Solana (SIWS) — implemented behind a flag

The root fix for #1–#3 is now in the codebase, **gated by `AUTH_REQUIRED` (default `false`)** so the
devnet demo is unaffected today:

- **Server** — `lib/auth.ts` (`issueNonce`, `verifyEd25519`, `resolveWallet`) + `POST /api/auth/nonce`.
  A single-use, Redis-stored, 5-min nonce is issued per wallet; the ed25519 signature is verified with
  `tweetnacl`; the nonce is atomically consumed (GET+DEL) so it can't be replayed. Enforcement **fails
  closed** (denies) if a signature is missing/invalid or Redis is down.
- **Routes** — `POST /api/reward/airdrop` and `POST /api/leaderboard` call `resolveWallet(body)`. With
  the flag on, they require `{ wallet, nonce, signature }`, mint only to / key the score on the
  **verified** pubkey, and reject unproven callers (closes Sybil farming + leaderboard IDOR). With the
  flag off, behavior is unchanged.
- **Client** — `lib/siws-client.ts` `signInWithSolana(pubkey, wallet.signMessage)` returns the proof to
  attach to those requests. Verified by `tests/auth.test.ts`.

**To turn it on in production:** (1) wire `signInWithSolana` into `store.signIn` so the airdrop +
leaderboard POSTs include the proof (one call — see the example in `lib/siws-client.ts`), then (2) set
`AUTH_REQUIRED=true` in the Railway/production env. Left off for now per the demo requirement.

## Other recommended next steps (not yet done)
2. **Server-authoritative economy (#6).** Compute win/loss/rewards server-side (the server already owns
   the match feed); the client should never send an absolute coin total.
3. **Real commit-reveal (#7).** Persist the salt server-side (or commit client-side with ≥128-bit
   entropy) and verify the preimage against the on-chain commitment before payout.
4. **CSP.** Add a Content-Security-Policy with a nonce for the inline theme script and the wallet
   adapters (deferred here to avoid breaking them).
5. **Residual deps.** `bigint-buffer` (via `@solana/spl-token`) and the `@irys/*` metadata-upload
   tooling have no non-breaking upstream fix yet; the mint amount is not attacker-controlled, so
   exploitability is low. Track upstream and bump when safe.

## deepsec false-positive triage

| deepsec matcher | Raw hits | Verdict |
|---|---|---|
| `xss` | 13 | False positive — OG route → PNG; theme script static; React auto-escapes |
| `insecure-crypto` | 16 | False positive — `randomBytes` (CSPRNG); zero `Math.random` |
| `ssrf` | 14 | Mostly false positive — fixed RPC/base host; one latent gated case (fixed) |
| `rce` | (airdrop) | False positive — static Lua literal, wallet passed as `ARGV[1]` |
| `missing-auth`, `rate-limit-bypass` | 41 | **Confirmed** — drove findings #1–#3, #5 |
