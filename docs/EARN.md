# Earning and the $PROOF token

How points, the $PROOF token, the welcome airdrop, and the parimutuel pool work.
Written twice: first in plain terms, then in full technical detail.

For the product-level story and tokenomics narrative, see
[WHITEPAPER.md](./WHITEPAPER.md) (and the PDF, `ProofBall-Whitepaper.pdf`).

---

## In plain terms

- You connect a Solana wallet. Your wallet address is who you are. No password.
- The first time a wallet connects, we **airdrop it 1,000 $PROOF** so it can play
  right away. $PROOF is a real token on Solana devnet. You can see it in your wallet.
- To make a call you pay a small **entry**: 5 $PROOF, or 0.0005 SOL. Paying in $PROOF
  is the cheaper path. Paying in SOL buys a bigger share of the pool.
- Everyone's entries for a round go into one **pool**. When the round settles against
  the real win-probability move, everyone who called the right direction **splits the
  pool**, in proportion to how much they staked. Losers forfeit their entry.
- Because devnet $PROOF and devnet SOL have no cash value, this is a demo of the
  mechanism, not real-money gambling.

Worked example: 5 players each pay the 5 $PROOF entry, so the pool is 25 $PROOF. 3 of
them call correctly. With equal stakes, each winner takes 25 / 3 = **8.33 $PROOF** (a
+3.33 profit funded by the 2 losers). If one winner had paid in SOL (a 2x share), they
would take twice the share of a $PROOF winner.

---

## Technical detail

### The $PROOF token
- A devnet SPL token, **6 decimals**. Created once with `npm run token:create`
  (`scripts/create-token.ts`), which prints the mint address to put in `.env` as
  `NEXT_PUBLIC_PROOF_MINT`.
- **Mint authority = the fee-payer wallet** (`FEE_PAYER_SECRET_KEY`, loaded by
  `lib/txline-auth.ts`), so the server can mint airdrops and rewards. No freeze authority.
- Server-side helpers live in `lib/token.ts`: `mintProof(wallet, amount)` (creates the
  recipient's associated token account if needed, then mints) and `proofBalance(wallet)`
  (reads the on-chain balance). Every call is a real on-chain write.
- **Wallet-visible identity (Metaplex Token Metadata).** `npm run token:metadata`
  (`scripts/set-token-metadata.ts`) attaches a metadata account to the mint with the name
  **ProofBall**, symbol **PROOF**, and the logo (`app/icon.png`, uploaded to Arweave via
  Irys). Without this, wallets show a bare mint address; with it, Phantom/Solflare/Backpack
  render "ProofBall" and the logo. Signed by the mint authority (the fee-payer); idempotent,
  so re-running updates the name/logo. Devnet addresses:

  | What | Address |
  | --- | --- |
  | mint | `EYYob1mBT42gPmbRM3ca3StVJiCq1S9d8RGCAKMYB2X1` |
  | metadata account | `7dcnMrAw8Msmhtr34dycThHw5XfHo7iyaiKoQXbKRDs` |

### The economy (one config file)
All numbers live in `lib/economy.ts` (`PROOF`), so the whole game retunes from one place:

| Setting | Value | Meaning |
| --- | --- | --- |
| `airdrop` | 1000 | welcome grant, once per wallet |
| `entryProof` | 5 | $PROOF per call (the discounted path) |
| `entrySol` | 0.0005 | SOL per call (real transfer) |
| `solPoolShare` | 2 | a SOL entry counts as this many $PROOF-stakes |
| `rakeBps` | 0 | house rake in basis points (0 = none) |
| `decimals` | 6 | SPL token decimals |

### The welcome airdrop
- `POST /api/reward/airdrop` with `{ wallet }` mints the one-time welcome airdrop.
- **Fund-once, across three independent guards** (a single flag is not enough for real
  on-chain value):
  1. **Atomic claim** — a Redis set `proofball:airdropped`; one `SADD`+`SCARD` Lua call so
     the same wallet can't claim two slots even under concurrent requests, and it doubles as
     the cap counter.
  2. **On-chain balance gate** — before minting we read the wallet's $PROOF balance; if it
     already holds ≥ the airdrop, we never mint again. This is the durable source of truth:
     it survives a wiped/restarted Redis **and** a prior mint that landed on-chain but timed
     out on confirmation.
  3. **Safe error handling** — a mint can *throw on confirmation yet still land* (spl-token
     confirms against a blockhash window that can lapse). On error we re-read the balance and
     only release the slot when nothing was minted. We do **not** blindly `srem` — that older
     behavior is exactly what let a confirmation timeout free the slot and a reconnect mint a
     second 1,000 (→ 2,000).
- **Audit ledger:** every airdrop is written to a Redis hash `proofball:airdrops`
  (`lib/airdrops.ts`) with `{ wallet, amount, position, ts, signature, status, balance }`.
  Inspect it with `npm run airdrops` (CLI) or `GET /api/admin/airdrops` (gated by the
  `ADMIN_TOKEN` secret). A recorded `balance` above the airdrop amount flags a pre-fix
  double-mint.
- The client fires this automatically inside `store.signIn` (see `lib/store.ts`). On the
  first airdrop the store sets `welcome`, which drives the `WelcomeToast` component
  ("We airdropped you 1,000 $PROOF").

### The parimutuel pool
- The payout math is a pure function, `settlePool(entries, outcome)` in `lib/pool.ts`,
  covered by `tests/pool.test.ts` (including the 5-players / 3-winners example).
- A **stake** is measured in $PROOF-equivalent value. A $PROOF entry stakes `entryProof`;
  a SOL entry stakes `entryProof * solPoolShare`.
- Settlement: `pool = sum of stakes`. Winners are the entries whose `dir` equals the
  outcome. Each winner's payout is:

  ```
  payout_i = stake_i / (sum of winning stakes) * pool * (1 - rake)
  ```

- Edge cases refund everyone (payout = stake): a `push` (no move), no winners, or everyone
  wins. Nobody is charged for a round that cannot be won fairly.

### What is on-chain vs off-chain
- **On-chain (real Solana devnet writes):** the $PROOF mint, its Metaplex token metadata
  (name/symbol/logo), the welcome airdrop, and (in the escrow build) stakes into the escrow
  and payouts to winners.
- **Off-chain (Redis):** the once-per-wallet airdrop set, round and pool state, and the
  shared leaderboard.

### Setup
1. Fund the fee-payer wallet with a little devnet SOL (faucet).
2. `npm run token:create` and copy the printed `NEXT_PUBLIC_PROOF_MINT=` line into `.env`.
3. `npm run token:metadata` to give the mint its name, symbol, and logo (so it shows as
   "ProofBall" with a logo in Phantom). Only needed once per mint; safe to re-run to update.
4. Restart the dev server so it picks up the mint. A fresh wallet now gets 1,000 $PROOF on
   connect, verifiable on the Solana explorer.

### Security and honest limitations
- Devnet $PROOF and devnet SOL have **no monetary value**. This demonstrates the mechanism;
  it is not real-money gambling.
- The airdrop and rewards are minted by a **server-held authority** (the fee-payer). Every
  movement is a public on-chain transaction anyone can verify, but the operator is trusted
  to run settlement honestly. The fully trustless version replaces this with an on-chain
  escrow program (Anchor); see the roadmap in the whitepaper.
