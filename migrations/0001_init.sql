-- ProofBall D1 schema. Replaces the Railway Postgres (matches, picks) and the
-- Railway Redis (leaderboard, airdrop ledger + claims, top-up idempotency,
-- rate limits, SIWS nonces, JSON cache).

-- Finished-match cache (was Postgres `matches`).
CREATE TABLE IF NOT EXISTS matches (
  fixture_id  TEXT PRIMARY KEY,
  competition TEXT    NOT NULL DEFAULT 'World Cup',
  round       TEXT    NOT NULL,
  round_rank  INTEGER NOT NULL,
  home_name   TEXT    NOT NULL,
  home_id     INTEGER,
  away_name   TEXT    NOT NULL,
  away_id     INTEGER,
  start_time  INTEGER NOT NULL,
  score_h     INTEGER,
  score_a     INTEGER,
  winner      TEXT,
  finished    INTEGER NOT NULL DEFAULT 1,
  synced_at   INTEGER NOT NULL
);

-- Settled calls per wallet (was Postgres `picks`).
CREATE TABLE IF NOT EXISTS picks (
  wallet      TEXT    NOT NULL,
  pick_id     TEXT    NOT NULL,
  dir         TEXT    NOT NULL,
  status      TEXT    NOT NULL,
  delta       REAL,
  reward      INTEGER NOT NULL DEFAULT 0,
  fixture_id  TEXT,
  verify_url  TEXT,
  at_minute   INTEGER,
  created_at  INTEGER NOT NULL,
  settled_at  INTEGER NOT NULL,
  PRIMARY KEY (wallet, pick_id)
);
CREATE INDEX IF NOT EXISTS picks_wallet_settled ON picks (wallet, settled_at DESC);

-- Global leaderboard (was Redis ZSET proofball:lb:coins + HASH proofball:lb:streak).
CREATE TABLE IF NOT EXISTS leaderboard (
  name   TEXT PRIMARY KEY,
  coins  INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS leaderboard_coins ON leaderboard (coins DESC);

-- Welcome-airdrop slots; row count is the cap counter (was Redis SET proofball:airdropped).
CREATE TABLE IF NOT EXISTS airdrop_claims (
  wallet     TEXT PRIMARY KEY,
  claimed_at INTEGER NOT NULL
);

-- Welcome-airdrop audit ledger (was Redis HASH proofball:airdrops).
CREATE TABLE IF NOT EXISTS airdrops (
  wallet TEXT PRIMARY KEY,
  record TEXT    NOT NULL,
  ts     INTEGER NOT NULL
);

-- Credited top-up tx signatures (was Redis SET proofball:topups).
CREATE TABLE IF NOT EXISTS topups (
  signature  TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);

-- Fixed-window rate limit counters (was Redis INCR proofball:rl:*).
CREATE TABLE IF NOT EXISTS rate_limits (
  key      TEXT PRIMARY KEY,
  count    INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);

-- Expiring key/value: JSON cache entries and single-use SIWS nonces.
CREATE TABLE IF NOT EXISTS kv (
  key        TEXT PRIMARY KEY,
  value      TEXT    NOT NULL,
  expires_at INTEGER
);
CREATE INDEX IF NOT EXISTS kv_expires ON kv (expires_at);
