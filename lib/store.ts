import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import type { Frame, MatchEvent, Phase, PickDir, Prediction, LeaderRow } from "./types";
import type { Sample } from "./candles";
import { homeWinPct } from "./winprob";
import { PROOF, winReward } from "./economy";

const HISTORY_LEN = 48;
// The candlestick chart aggregates the whole match, so it keeps a longer,
// minute-stamped tape than the 48-point sparkline. A match tops out at a few
// hundred odds ticks; 720 is generous headroom that still bounds memory.
const SAMPLE_LEN = 720;
// Keep the full match event log, not just the last handful, so the feed can show
// as many real events (goals, shots, corners, cards…) as the API emits. A match
// tops out around a hundred events; 300 is generous headroom that still bounds
// memory. The feed renders newest-first and scrolls horizontally through them.
const MATCH_EVENTS_LEN = 300;

let _id = 0;
const nextId = () => `${Date.now()}-${_id++}`;

/** Outcome of a cash-out (playable $PROOF ledger → real on-chain mint). */
export interface CashOutResult {
  ok: boolean;
  error?: string;
  minted?: number; // whole $PROOF actually minted on-chain
  explorerUrl?: string;
}

// Storage for the persist middleware. Only a browser has localStorage, so on the
// server (Next SSR) and under tests we fall back to a no-op — persistence simply
// does nothing there instead of throwing on the first setState.
const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};
const webStorage = (): StateStorage =>
  typeof window !== "undefined" ? window.localStorage : noopStorage;

interface StoreState {
  // connection
  connected: boolean;
  mode: "replay" | "live";

  // match
  scoreH: number;
  scoreA: number;
  minute: number;
  phase: Phase;
  winProbHome: number; // %
  drawProb: number;
  awayProb: number;
  probHistory: number[];
  probSamples: Sample[]; // minute-stamped tape for the candlestick chart
  lastEvent: MatchEvent | null;
  events: MatchEvent[];
  flashKey: number; // bumps to trigger a needle flash

  // user + game
  user: { name: string; wallet: string } | null;
  coins: number;
  streak: number;
  best: number;
  current: Prediction | null;
  history: Prediction[];
  lastSettleAt: number;
  leaderboard: LeaderRow[];

  // The just-settled call, as a one-shot token. `n` bumps on every settlement so
  // UI (the PredictControl outcome disc, sound, celebration) can react to the
  // edge without re-firing on unrelated renders. Null until the first settle.
  lastResult: {
    outcome: "won" | "lost";
    reward: number; // coins won on a right call (0 on a loss)
    penalty: number; // coins lost on a wrong call (0 on a win)
    streak: number;
    delta: number;
    brokeStreak: boolean; // a streak of 3+ just ended
    newBest: boolean; // this win set a new personal-best streak
    n: number;
  } | null;

  // $PROOF token
  proof: number; // on-chain $PROOF balance
  // First-connect airdrop notice that drives WelcomeToast. `granted` = a fresh
  // airdrop just minted (celebrate); `error` = it failed after retries (offer a
  // manual retry). An already-funded reconnect sets no notice — it just reflects
  // the on-chain balance.
  welcome:
    | { kind: "granted"; amount: number; url?: string }
    | { kind: "error" }
    | null;

  // actions
  setConnected: (b: boolean) => void;
  setMode: (m: "replay" | "live") => void;
  resetMatch: () => void;
  ingest: (f: Frame) => void;
  signIn: (name: string, wallet: string) => void;
  signOut: () => void;
  dismissWelcome: () => void;
  retryAirdrop: () => void;
  refreshProof: () => Promise<void>;
  // Cash out `amount` playable $PROOF: debit the in-game ledger and mint an equal
  // amount of REAL on-chain $PROOF into the wallet. Resolves to the outcome so the
  // Earn card can show a receipt / error without a global one-shot token.
  cashOut: (amount: number) => Promise<CashOutResult>;
  // Credit the playable ledger after a top-up's on-chain transfer has been verified
  // server-side. The signature + verification happen in the component (it needs the
  // wallet); this just moves the already-confirmed amount into the ledger + board.
  applyDeposit: (amount: number) => void;
  openMarket: (now: number) => void;
  setPick: (dir: PickDir) => void;
  lockMarket: (now: number) => void;
  attachProof: (memoSig: string, verifyUrl: string) => void;
  skipMarket: () => void;
  settleMarket: (now: number) => void;
  // Shared leaderboard (Redis-backed): pull the global board; restore stored points.
  syncLeaderboard: () => Promise<void>;
  restoreScore: (name: string) => Promise<void>;
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
  connected: false,
  mode: "replay",
  scoreH: 0,
  scoreA: 0,
  minute: 0,
  phase: "PRE",
  winProbHome: 50,
  drawProb: 27,
  awayProb: 23,
  probHistory: [],
  probSamples: [],
  lastEvent: null,
  events: [],
  flashKey: 0,

  user: null,
  coins: PROOF.start,
  streak: 0,
  best: 0,
  current: null,
  history: [],
  lastSettleAt: 0,
  leaderboard: [],
  lastResult: null,
  proof: 0,
  welcome: null,

  setConnected: (b) => set({ connected: b }),
  setMode: (m) => set({ mode: m }),

  // Reset the live match state when switching fixtures. User progress
  // (coins, streak, pick history, leaderboard) persists across matches.
  resetMatch: () =>
    set({
      connected: false,
      scoreH: 0,
      scoreA: 0,
      minute: 0,
      phase: "PRE",
      winProbHome: 50,
      drawProb: 27,
      awayProb: 23,
      probHistory: [],
      probSamples: [],
      lastEvent: null,
      events: [],
      current: null,
      lastSettleAt: 0,
    }),

  ingest: (f) => {
    if (f.kind === "odds") {
      const home = homeWinPct(f);
      if (home == null) return;
      const draw = Number(f.Pct[1] ?? get().drawProb);
      const away = Number(f.Pct[2] ?? get().awayProb);
      set((s) => ({
        winProbHome: home,
        drawProb: draw,
        awayProb: away,
        probHistory: [...s.probHistory, home].slice(-HISTORY_LEN),
        // Stamp with the current match minute so the chart buckets on the game
        // clock, not wall-clock. Odds lead their clock frame by one event, so
        // this trails the true minute by a tick, invisible at candle scale.
        probSamples: [...s.probSamples, { m: s.minute, p: home }].slice(-SAMPLE_LEN),
      }));
    } else if (f.kind === "clock") {
      set({ minute: f.minute, phase: f.phase });
    } else if (f.kind === "score") {
      const big = f.action === "goal" || f.action === "red_card";
      const ev: MatchEvent = {
        id: nextId(),
        action: f.action,
        team: f.team,
        label: f.label,
        minute: f.minute,
        big,
      };
      set((s) => ({
        scoreH: f.scoreH,
        scoreA: f.scoreA,
        minute: f.minute,
        lastEvent: ev,
        events: [ev, ...s.events].slice(0, MATCH_EVENTS_LEN),
        flashKey: big ? s.flashKey + 1 : s.flashKey,
      }));
    }
  },

  signIn: (name, wallet) => {
    set((s) => ({
      user: { name, wallet },
      leaderboard: mergeYou(s.leaderboard, name, s.coins, s.streak),
    }));
    // Restore any score this player already has (adopting the stored value, since
    // the score is now a P&L that can go down). restoreScore also seeds a
    // first-time player onto the shared board — we must NOT eagerly post the
    // local default here, or it would reset a returning player's lower score.
    void get().restoreScore(name);
    // Load this wallet's durable call history (DB-backed) so "Your calls"
    // survives reloads, cache clears and other devices, not just localStorage.
    void loadStoredPicks(wallet);
    // Claim the one-time welcome airdrop. The server is the mint authority and is
    // idempotent, so a reconnect never re-airdrops. claimWelcomeAirdrop retries the
    // cold-start 503 (a freshly-woken instance rejects its first Redis call, then
    // succeeds warm) so a fresh wallet is never left silently at 0, and always
    // resolves to a visible outcome — a toast or a quietly-updated balance.
    void claimWelcomeAirdrop(wallet);
  },

  signOut: () => set({ user: null, current: null, welcome: null, proof: 0 }),
  dismissWelcome: () => set({ welcome: null }),
  // The error toast's "Retry": clear the notice and re-run the claim, so the next
  // terminal state (granted / error) is what surfaces.
  retryAirdrop: () => {
    const wallet = get().user?.wallet;
    if (!wallet) return;
    set({ welcome: null });
    void claimWelcomeAirdrop(wallet);
  },

  // Pull the wallet's current on-chain $PROOF balance (shown on the profile).
  refreshProof: async () => {
    const wallet = get().user?.wallet;
    if (!wallet) return;
    try {
      const res = await fetch(`/api/reward/airdrop?wallet=${encodeURIComponent(wallet)}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const d = await res.json();
      if (typeof d.balance === "number") set({ proof: d.balance });
    } catch {
      /* keep the last known balance */
    }
  },

  // Cash out playable $PROOF into the wallet as real on-chain tokens. Optimistic:
  // the in-game ledger drops instantly (so the balance and the leaderboard move
  // right away), then the server mints the same amount on-chain. If the mint fails
  // — nothing landed — we roll the ledger back. Functional set()s keep this safe if
  // a call happens to settle mid-flight.
  cashOut: async (amount) => {
    const wallet = get().user?.wallet;
    if (!wallet) return { ok: false, error: "Connect a wallet first" };

    const amt = Math.floor(amount);
    if (!Number.isFinite(amt) || amt < PROOF.cashout.min) {
      return { ok: false, error: `Cash out at least ${PROOF.cashout.min} $PROOF` };
    }
    if (amt > get().coins) return { ok: false, error: "Not enough $PROOF" };

    const applyDelta = (delta: number) =>
      set((st) => {
        const coins = Math.max(0, st.coins + delta);
        return {
          coins,
          leaderboard: mergeYou(st.leaderboard, st.user?.name ?? "you", coins, st.streak),
        };
      });

    applyDelta(-amt); // optimistic debit
    postScore(get().user?.name, get().coins, get().streak);

    try {
      const res = await fetch("/api/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, amount: amt }),
      });
      const d = (await res.json().catch(() => null)) as
        | { minted?: boolean; amount?: number; balance?: number; explorerUrl?: string; rateLimited?: boolean; error?: string }
        | null;

      if (!res.ok || !d?.minted) {
        applyDelta(amt); // roll back — nothing was minted
        postScore(get().user?.name, get().coins, get().streak);
        const error = d?.rateLimited
          ? "Too many cash-outs — try again shortly"
          : d?.error || "Cash out failed";
        return { ok: false, error };
      }

      // Real $PROOF landed in the wallet; reflect the on-chain balance for the receipt.
      if (typeof d.balance === "number") set({ proof: d.balance });
      return { ok: true, minted: d.amount ?? amt, explorerUrl: d.explorerUrl };
    } catch {
      applyDelta(amt); // roll back on a transport error
      postScore(get().user?.name, get().coins, get().streak);
      return { ok: false, error: "Network error — try again" };
    }
  },

  applyDeposit: (amount) => {
    const amt = Math.floor(amount);
    if (!Number.isFinite(amt) || amt <= 0) return;
    set((st) => {
      const coins = st.coins + amt;
      return { coins, leaderboard: mergeYou(st.leaderboard, st.user?.name ?? "you", coins, st.streak) };
    });
    postScore(get().user?.name, get().coins, get().streak);
    void get().refreshProof(); // the wallet balance dropped on-chain; reflect it in the receipt
  },

  openMarket: (now) => {
    if (get().current || !get().user) return;
    const p: Prediction = {
      id: nextId(),
      prompt: `Where does the win-probability go next?`,
      createdAt: now,
      lockAt: now + 30_000, // 30s to make the call
      settleAt: null,
      dir: null,
      lockedProb: null,
      status: "open",
    };
    set({ current: p });
  },

  setPick: (dir) =>
    set((s) => (s.current && s.current.status === "open" ? { current: { ...s.current, dir } } : {})),

  lockMarket: (now) =>
    set((s) => {
      if (!s.current || s.current.status !== "open") return {};
      if (!s.current.dir) return {}; // handled by skipMarket
      return {
        current: {
          ...s.current,
          status: "locked",
          lockedProb: s.winProbHome,
          settleAt: now + 30_000, // 30s hold before we settle the call
        },
      };
    }),

  attachProof: (memoSig, verifyUrl) =>
    set((s) => (s.current ? { current: { ...s.current, memoSig, verifyUrl } } : {})),

  skipMarket: () => set({ current: null, lastSettleAt: Date.now() }),

  settleMarket: (now) => {
    const s = get();
    const c = s.current;
    if (!c || c.status !== "locked" || c.lockedProb == null) return;
    const delta = +(s.winProbHome - c.lockedProb).toFixed(1);
    const movedUp = delta > 0.3;
    const movedDown = delta < -0.3;
    const won = (c.dir === "up" && movedUp) || (c.dir === "down" && movedDown);
    const streak = won ? s.streak + 1 : 0;
    const reward = won ? winReward(streak) : 0;
    // The score is a play-money P&L: a right call wins the reward, a wrong call
    // loses the stake (never below 0). Either way the number moves every call.
    const penalty = won ? 0 : Math.min(PROOF.stake, s.coins);
    const coins = s.coins + reward - penalty;
    const settled: Prediction = {
      ...c,
      status: won ? "won" : "lost",
      delta,
      reward: won ? reward : -penalty,
    };
    set({
      current: null,
      history: [settled, ...s.history].slice(0, 30),
      coins,
      streak,
      best: Math.max(s.best, streak),
      lastSettleAt: now,
      leaderboard: mergeYou(s.leaderboard, s.user?.name ?? "you", coins, streak),
      // One-shot settlement token. Drives the PredictControl outcome disc, the
      // reward count-up, sound, and the rare milestone celebration.
      lastResult: {
        outcome: won ? "won" : "lost",
        reward,
        penalty,
        streak,
        delta,
        brokeStreak: !won && s.streak >= 3,
        newBest: won && streak > s.best,
        n: (s.lastResult?.n ?? 0) + 1,
      },
    });
    // Persist the new total to the shared Redis leaderboard.
    postScore(s.user?.name, coins, streak);
    // Durably record the settled call in the DB, keyed by wallet, so it can be
    // reloaded on any later session or device (localStorage is only a fast cache).
    savePickToDb(s.user?.wallet, settled);
    // The gameplay loop is off-chain by design ("$PROOF is the game", arcade
    // model): a settled call moves the playable ledger instantly, with no wallet
    // signature and no chain write. Real on-chain $PROOF is minted only on the
    // welcome airdrop and when the player deliberately cashes out (see cashOut).
  },

  syncLeaderboard: async () => {
    try {
      const name = get().user?.name;
      const q = name ? `?name=${encodeURIComponent(name)}` : "";
      const res = await fetch(`/api/leaderboard${q}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const rows: SharedRow[] = Array.isArray(data.rows) ? data.rows : [];
      set((st) => ({ leaderboard: mergeShared(rows, st.user?.name, st.coins, st.streak) }));
    } catch {
      /* keep the current board */
    }
  },

  restoreScore: async (name) => {
    try {
      const res = await fetch(`/api/leaderboard?name=${encodeURIComponent(name)}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const rows: SharedRow[] = Array.isArray(data.rows) ? data.rows : [];
      const me = data.me as SharedRow | null;
      set((st) => {
        // The stored score is authoritative — the score is a P&L that can go
        // down, so we adopt it rather than keeping the local max. A first-time
        // player has no stored row yet and keeps their starting balance.
        const coins = me ? me.coins : st.coins;
        const streak = me ? me.streak : st.streak;
        return { coins, streak, leaderboard: mergeShared(rows, name, coins, streak) };
      });
      // Seed a first-time player onto the shared board at their starting score.
      if (!me) {
        const st = get();
        postScore(name, st.coins, st.streak);
      }
    } catch {
      /* offline , stay on the local board */
    }
  },
    }),
    {
      name: "proofball:v1",
      version: 1,
      storage: createJSONStorage(webStorage),
      // Only durable user progress survives a reload. Live match + connection
      // state, the in-flight call, one-shot tokens, and fetched data (proof,
      // leaderboard) are all rebuilt from the feed/chain, so they stay out of
      // storage. `history` in particular has no server backup — persisting it
      // here is what stops "Your calls" from clearing on every refresh.
      partialize: (s) => ({
        history: s.history,
        coins: s.coins,
        streak: s.streak,
        best: s.best,
      }),
      // Next SSRs these client components with the default (empty) state.
      // Hydrating from localStorage during render would diverge from the server
      // HTML, so we skip the automatic hydrate and rehydrate after mount (see
      // Providers): first client paint matches the server, then the stored
      // calls fill in — the same post-mount pattern the wallet gate uses.
      skipHydration: true,
    },
  ),
);

function mergeYou(board: LeaderRow[], name: string, coins: number, streak: number): LeaderRow[] {
  const others = board.filter((r) => !r.you);
  const you: LeaderRow = { name, coins, streak, you: true };
  return [...others, you].sort((x, y) => y.coins - x.coins);
}

interface SharedRow {
  name: string;
  coins: number;
  streak: number;
}

// Retry budget for the welcome airdrop. The airdrop route hard-fails (503) on the
// first Redis command against a cold serverless instance, then succeeds once warm,
// so these transient statuses are worth a short backed-off retry rather than a
// silent 0-balance. Non-retryable statuses (429 burst, 4xx) fall straight to the
// error toast, which offers a manual retry.
const AIRDROP_RETRIES = 4;
const AIRDROP_RETRYABLE = new Set([500, 502, 503, 504]);
const airdropBackoff = (attempt: number) => 400 + attempt * 600; // 0.4s, 1.0s, 1.6s, 2.2s
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Decide the terminal outcome once the claim POST can't confirm an airdrop. A
 * rate-limited (429) or transient POST fails even for a wallet that ALREADY holds
 * its airdrop — showing "couldn't load" there is wrong. The GET balance read is
 * NOT rate-limited, so it's a reliable last check: an already-funded wallet just
 * reflects its balance (no toast); only a genuinely unfunded wallet gets the error
 * toast + Retry. Guarded on the wallet still being current.
 */
async function resolveAirdropOutcome(wallet: string): Promise<void> {
  let balance = 0;
  try {
    const res = await fetch(`/api/reward/airdrop?wallet=${encodeURIComponent(wallet)}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const d = await res.json();
      if (typeof d?.balance === "number") balance = d.balance;
    }
  } catch {
    /* no balance read → treat as unfunded below */
  }
  if (useStore.getState().user?.wallet !== wallet) return;
  if (balance >= PROOF.airdrop) {
    useStore.setState({ proof: balance }); // already funded — the claim just couldn't run
  } else {
    useStore.setState({ welcome: { kind: "error" }, proof: balance });
  }
}

/**
 * Claim the one-time welcome airdrop for `wallet`, tolerant of the cold-start race
 * above. Retries the transient statuses and ALWAYS resolves to a visible outcome so
 * a new wallet is never left silently at 0 $PROOF:
 *   • airdropped        → the celebratory "granted" toast, balance updated
 *   • already / capped  → balance quietly reflected, no toast (a reconnect)
 *   • exhausted / 4xx   → an "error" toast offering a manual retry
 * Every state write is guarded on the wallet still being the current one, so a
 * mid-flight account switch or sign-out can never clobber the new session.
 */
async function claimWelcomeAirdrop(wallet: string, attempt = 0): Promise<void> {
  const isCurrent = () => useStore.getState().user?.wallet === wallet;
  try {
    const res = await fetch("/api/reward/airdrop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet }),
    });
    const d = (await res.json().catch(() => null)) as
      | { airdropped?: boolean; amount?: number; explorerUrl?: string; balance?: number }
      | null;
    if (!isCurrent()) return;
    if (res.ok) {
      if (d?.airdropped) {
        useStore.setState({
          welcome: { kind: "granted", amount: d.amount ?? 0, url: d.explorerUrl },
          proof: d.balance ?? 0,
        });
      } else if (typeof d?.balance === "number") {
        useStore.setState({ proof: d.balance }); // already funded / capped — no toast
      }
      return; // any 2xx is a benign, resolved outcome
    }
    if (AIRDROP_RETRYABLE.has(res.status) && attempt < AIRDROP_RETRIES) {
      await wait(airdropBackoff(attempt));
      if (isCurrent()) await claimWelcomeAirdrop(wallet, attempt + 1);
      return;
    }
    await resolveAirdropOutcome(wallet);
  } catch {
    // Network / transport error — retry, then surface the error toast.
    if (!isCurrent()) return;
    if (attempt < AIRDROP_RETRIES) {
      await wait(airdropBackoff(attempt));
      if (isCurrent()) await claimWelcomeAirdrop(wallet, attempt + 1);
      return;
    }
    await resolveAirdropOutcome(wallet);
  }
}

// Fire-and-forget upsert of a player's points to the shared Redis leaderboard.
function postScore(name: string | undefined, coins: number, streak: number): void {
  if (!name) return;
  try {
    void fetch("/api/leaderboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, coins, streak }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

// Fire-and-forget durable save of a settled call to the DB, keyed by wallet.
// The gameplay loop stays off-chain ("$PROOF is the game"); this is just the
// player's own call record, so it needs no signature — the route validates the
// wallet and clamps the reward.
function savePickToDb(wallet: string | undefined, pick: Prediction): void {
  if (!wallet) return;
  try {
    void fetch("/api/picks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallet,
        pick: {
          id: pick.id,
          dir: pick.dir,
          status: pick.status,
          delta: pick.delta,
          reward: pick.reward,
          verifyUrl: pick.verifyUrl,
          createdAt: pick.createdAt,
          settledAt: pick.settleAt,
        },
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

// Load a wallet's durable call history from the DB and merge it into the
// in-memory list: DB is authoritative, but we keep any just-made local call not
// yet saved. Guarded on the wallet still being current (a mid-flight account
// switch must not clobber the new session), like the airdrop claim.
async function loadStoredPicks(wallet: string): Promise<void> {
  try {
    const res = await fetch(`/api/picks?wallet=${encodeURIComponent(wallet)}`, { cache: "no-store" });
    if (!res.ok) return;
    const d = (await res.json().catch(() => null)) as { picks?: Prediction[] } | null;
    if (!d?.picks || useStore.getState().user?.wallet !== wallet) return;
    useStore.setState((st) => {
      const byId = new Map<string, Prediction>();
      for (const p of st.history) byId.set(p.id, p); // local session calls
      for (const p of d.picks!) byId.set(p.id, p); // DB wins on shared ids
      const merged = [...byId.values()]
        .sort((a, b) => (b.settleAt ?? 0) - (a.settleAt ?? 0))
        .slice(0, 30);
      return { history: merged };
    });
  } catch {
    /* offline — keep the localStorage-cached calls */
  }
}

// Build the board from the shared rows, overlaying the local "you" (authoritative
// for your own live coins) so your row is always present and up to date.
function mergeShared(
  rows: SharedRow[],
  youName: string | undefined,
  youCoins: number,
  youStreak: number
): LeaderRow[] {
  const others: LeaderRow[] = rows
    .filter((r) => r.name !== youName)
    .map((r) => ({ name: r.name, coins: r.coins, streak: r.streak }));
  const board = youName
    ? [...others, { name: youName, coins: youCoins, streak: youStreak, you: true }]
    : others;
  return board.sort((a, b) => b.coins - a.coins);
}
