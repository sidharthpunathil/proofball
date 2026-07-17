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

let _id = 0;
const nextId = () => `${Date.now()}-${_id++}`;

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
  refreshProof: () => Promise<void>;
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
  coins: 500,
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
        events: [ev, ...s.events].slice(0, 20),
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
    // Mint the one-time welcome airdrop of $PROOF to this wallet (server is the
    // mint authority). Idempotent server-side, so reconnecting never re-airdrops.
    void fetch("/api/reward/airdrop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.airdropped) set({ welcome: { amount: d.amount, url: d.explorerUrl }, proof: d.balance ?? 0 });
        else if (typeof d?.balance === "number") set({ proof: d.balance });
      })
      .catch(() => {
        /* airdrop is best-effort; play continues */
      });
  },

  signOut: () => set({ user: null, current: null, welcome: null, proof: 0 }),
  dismissWelcome: () => set({ welcome: null }),

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
    // A correct call also pays out for real: mint the reward as devnet $PROOF to
    // the wallet on-chain. This is what makes playing a finished match real play
    // and not just points. Best-effort — the game never blocks on the chain.
    if (won && reward > 0) mintWin(s.user?.wallet, reward);
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

// Fire-and-forget on-chain payout of a won call: mints the reward as REAL devnet
// $PROOF to the wallet (server holds the mint authority). The leaderboard points
// already counted synchronously; this tops up the real balance and, on success,
// updates the store's `proof` so the Profile/Earn balance reflects the chain.
// Fully best-effort: any failure (rate limit, RPC hiccup, no wallet) is swallowed.
function mintWin(wallet: string | undefined, amount: number): void {
  if (!wallet || amount <= 0) return;
  try {
    void fetch("/api/reward/win", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet, amount }),
      keepalive: true,
    })
      .then((r) => r.json())
      .then((d) => {
        if (d && typeof d.balance === "number") useStore.setState({ proof: d.balance });
      })
      .catch(() => {});
  } catch {
    /* ignore */
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
