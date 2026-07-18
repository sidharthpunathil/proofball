"use client";

import { useEffect, useRef, useState } from "react";
import { m, AnimatePresence, useReducedMotion } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";
import { useStore } from "@/lib/store";
import { tweenFast } from "@/lib/motion";
import { FixtureProvider } from "@/lib/fixture-context";
import type { FixtureView } from "@/lib/types";
import AppHeader from "./AppHeader";
import MatchHeader from "./MatchHeader";
import ProbabilityNeedle from "./ProbabilityNeedle";
import ProbabilityChart from "./ProbabilityChart";
import Sparkline from "./Sparkline";
import Segmented from "./Segmented";
import PredictControl from "./PredictControl";
import MatchOver from "./MatchOver";
import PickHistory from "./PickHistory";
import EventFeed from "./EventFeed";
import Leaderboard from "./Leaderboard";
import EarnPanel from "./EarnPanel";
import SignInGate from "./SignInGate";
import WelcomeToast from "./WelcomeToast";
import Celebration from "./fx/Celebration";
import BottomNav, { type Tab } from "./BottomNav";
import { User, ExternalLink, Gift, Gauge, CandlestickChart } from "./Icons";
import { PROOF } from "@/lib/economy";

// The win-probability card has two presentations: PERCENT (the arc gauge) and
// CHART (a candlestick chart of the win-prob over match time). The choice, and
// the chart timeframe, persist in localStorage so a player's preference sticks.
type ProbView = "percent" | "chart";
const VIEW_OPTIONS = [
  { value: "percent" as ProbView, label: <Gauge size={14} />, title: "Percent view" },
  { value: "chart" as ProbView, label: <CandlestickChart size={14} />, title: "Chart view" },
];

export default function MatchScreen({ fixture }: { fixture: FixtureView }) {
  const homeProb = useStore((s) => s.winProbHome);
  const drawProb = useStore((s) => s.drawProb);
  const awayProb = useStore((s) => s.awayProb);
  const history = useStore((s) => s.probHistory);
  const samples = useStore((s) => s.probSamples);
  const flashKey = useStore((s) => s.flashKey);
  const [tab, setTab] = useState<Tab>("match");
  // Win-prob presentation + candle timeframe. Defaults are constant on first
  // render (no SSR mismatch); the stored preference is applied after mount.
  const [view, setView] = useState<ProbView>("percent");
  const [candleMin, setCandleMin] = useState(5);
  // Replay playback speed for a finished match (1×–100×; 1× = real time).
  // Changing it reconnects the stream at the new pace but RESUMES from the
  // current minute (see the SSE effect), so the time + win-probability hold
  // steady instead of snapping back to kick-off.
  const [speed, setSpeed] = useState(1);
  // Last fixture the SSE effect connected for, so it can tell a pure speed change
  // (resume in place) from a real fixture load / switch (reset, start at 0').
  const prevFixtureRef = useRef<string | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    try {
      const v = localStorage.getItem("pb:probView");
      if (v === "percent" || v === "chart") setView(v);
      const iv = Number(localStorage.getItem("pb:candleMin"));
      if ([1, 5, 15].includes(iv)) setCandleMin(iv);
    } catch {
      /* preference is best-effort */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("pb:probView", view);
    } catch {
      /* ignore */
    }
  }, [view]);
  useEffect(() => {
    try {
      localStorage.setItem("pb:candleMin", String(candleMin));
    } catch {
      /* ignore */
    }
  }, [candleMin]);

  // A finished match replays its real event log, but it's still real play on
  // devnet: you call the (modelled) needle and a correct call mints real devnet
  // $PROOF to your wallet. The result is known, so the edge is reading the needle.
  const isFinished = fixture.status === "finished";

  // 1) Real data via same-origin SSE. The proxy serves the most real feed
  //    available for this fixture (live → recorded log → sample). Auth is
  //    attached server-side; the browser sends no headers.
  useEffect(() => {
    // Load persisted progress (your calls, coins, streak) from localStorage
    // BEFORE any resetMatch() below. Effects run child-first, so this component's
    // effect fires before the provider's rehydrate; without this, resetMatch()'s
    // state write would persist an empty `history` over the stored calls, wiping
    // "Your calls" on every load. Rehydrate is synchronous + idempotent.
    void useStore.persist.rehydrate();

    const st = useStore.getState();
    // A pure speed change RESUMES where the replay is: skip resetMatch (the score,
    // minute, needle % and candle tape all hold) and tell the stream to seek past
    // the minute already on screen (?from=). A first mount or a switch to a
    // different fixture starts clean from kick-off (0').
    const sameFixture = prevFixtureRef.current === fixture.id;
    prevFixtureRef.current = fixture.id;
    const from = sameFixture ? Math.max(0, st.minute) : 0;
    if (!sameFixture) st.resetMatch();

    const q = `fixtureId=${fixture.id}&speed=${speed}${from > 0 ? `&from=${from}` : ""}`;
    const es = new EventSource(`/api/txline/stream?${q}`);
    es.onopen = () => st.setConnected(true);
    es.onmessage = (e) => {
      try {
        st.ingest(JSON.parse(e.data));
      } catch {
        /* ignore */
      }
    };
    es.onerror = () => useStore.getState().setConnected(false);
    return () => es.close();
  }, [fixture.id, speed]);

  // 2) Prediction loop: open → lock (on-chain commit) → settle. Runs for finished
  //    matches too , there it drives the replay where correct calls mint devnet $PROOF.
  useEffect(() => {
    const iv = setInterval(() => {
      const s = useStore.getState();
      const now = Date.now();
      if (!s.user) return;
      if (!s.current) {
        if (now - s.lastSettleAt > 3500) s.openMarket(now);
        return;
      }
      if (s.current.status === "open" && now >= s.current.lockAt) {
        if (s.current.dir) {
          s.lockMarket(now);
          void commitOnChain(fixture.id);
        } else s.skipMarket();
      }
      if (s.current.status === "locked" && s.current.settleAt && now >= s.current.settleAt) {
        s.settleMarket(now);
      }
    }, 250);
    return () => clearInterval(iv);
  }, [fixture.id]);

  return (
    <FixtureProvider value={fixture}>
      <div className="relative mx-auto min-h-screen w-full max-w-md">
        <AppHeader />

        <div className="pb-28">
          <AnimatePresence mode="wait">
            <m.div
              key={tab}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={tweenFast}
            >
              {tab === "match" && (
                <div className="flex flex-col gap-5">
                  <MatchHeader />
                  {isFinished && <SpeedControl speed={speed} onSpeed={setSpeed} />}
                  <div className="px-4">
                    <div className="mb-3 flex justify-center">
                      <Segmented
                        options={VIEW_OPTIONS}
                        value={view}
                        onChange={setView}
                        layoutId="probView"
                        variant="solid"
                        ariaLabel="Win-probability view"
                      />
                    </div>
                    {view === "percent" ? (
                      <m.div
                        key="percent"
                        initial={reduce ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={tweenFast}
                      >
                        <ProbabilityNeedle
                          homeProb={homeProb}
                          drawProb={drawProb}
                          awayProb={awayProb}
                          home={fixture.home.abbr}
                          away={fixture.away.abbr}
                          homeColor={fixture.home.color}
                          awayColor={fixture.away.color}
                          flashKey={flashKey}
                        />
                        <div className="mt-1">
                          <Sparkline data={history} />
                        </div>
                      </m.div>
                    ) : (
                      <m.div
                        key="chart"
                        initial={reduce ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={tweenFast}
                      >
                        <ProbabilityChart
                          samples={samples}
                          homeProb={homeProb}
                          drawProb={drawProb}
                          awayProb={awayProb}
                          home={fixture.home.abbr}
                          away={fixture.away.abbr}
                          homeColor={fixture.home.color}
                          awayColor={fixture.away.color}
                          interval={candleMin}
                          onInterval={setCandleMin}
                          flashKey={flashKey}
                        />
                      </m.div>
                    )}
                  </div>
                  {isFinished && <MatchOver />}
                  <PredictControl />
                  <EventFeed />
                  <PickHistory limit={3} />
                </div>
              )}

              {tab === "board" && (
                <div className="pt-2">
                  <Leaderboard />
                </div>
              )}

              {tab === "earn" && (
                <div className="pt-2">
                  <EarnPanel />
                </div>
              )}

              {tab === "activity" && (
                <div className="flex flex-col gap-5 pt-2">
                  <PickHistory showEmpty />
                  <EventFeed />
                </div>
              )}

              {tab === "profile" && <Profile />}
            </m.div>
          </AnimatePresence>
        </div>

        <BottomNav tab={tab} setTab={setTab} />
        <SignInGate />
        <WelcomeToast />
        <Celebration />
      </div>
    </FixtureProvider>
  );
}

// A finished match replays from kick-off. 1× is REAL TIME , a 90' match takes 90
// min, the way it moved live; the rest fast-forward it: 2× = 45 min, 5× = 18, 10×
// = 9, 20× = 4.5, 50× = ~1.8, 100× = ~0.9 min. Selecting a speed reconnects the
// stream but RESUMES from the current minute (SSE effect), so only the pace
// changes , the time + win-probability stay put.
const SPEEDS = [1, 2, 5, 10, 20, 50, 100] as const;

function SpeedControl({ speed, onSpeed }: { speed: number; onSpeed: (n: number) => void }) {
  // Seven options don't fit an inline label + pill row on a phone, so the label
  // sits above and the pills flex to fill the width (each an equal share).
  return (
    <div className="flex flex-col items-center gap-1.5 px-4">
      <span className="text-[10px] font-semibold uppercase tracking-[0.4px] text-mut">Replay speed</span>
      <div className="flex w-full items-center gap-0.5 rounded-full border border-line bg-surface p-0.5 shadow-soft">
        {SPEEDS.map((s) => {
          const active = s === speed;
          return (
            <button
              key={s}
              type="button"
              onClick={() => onSpeed(s)}
              aria-pressed={active}
              aria-label={`${s} times speed`}
              className={`flex-1 rounded-full px-1 py-1 text-[12px] font-bold tabular-nums transition-colors ${
                active ? "bg-ink text-bg" : "text-ink2 hover:text-ink"
              }`}
            >
              {s}×
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Profile() {
  const user = useStore((s) => s.user);
  const proof = useStore((s) => s.proof);
  const refreshProof = useStore((s) => s.refreshProof);
  const { disconnect } = useWallet();
  // A balance sitting at exactly the welcome grant means the wallet has not
  // spent or won yet, so it is still the untouched airdrop.
  const isWelcome = proof === PROOF.airdrop;
  // Disconnecting the wallet cascades to signOut() via the effect in SignInGate,
  // so we never leave the app "signed in" while the wallet is still connected.
  useEffect(() => {
    void refreshProof();
  }, [refreshProof]);
  return (
    <div className="flex flex-col gap-4 px-4 pt-2">
      <div className="flex items-center gap-3 rounded-[22px] border border-line bg-surface p-4 shadow-soft">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-subtle text-ink2">
          <User size={22} />
        </div>
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold text-ink">{user?.name ?? "Guest"}</div>
          <div className="truncate font-mono text-[12px] text-mut">{user?.wallet ?? "not signed in"}</div>
        </div>
      </div>

      {/* $PROOF balance. The headline is always the wallet's live on-chain
          balance (s.proof), never the fixed airdrop constant. While it is still
          the untouched welcome grant we add a small note about where it came
          from, without repeating the number the headline already shows. */}
      <div
        className={`relative overflow-hidden rounded-[22px] border bg-surface p-4 shadow-soft ${
          isWelcome ? "border-grn/30" : "border-line"
        }`}
      >
        {isWelcome && (
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-grn/15 blur-2xl"
          />
        )}
        <div className="relative flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/proofball-logo.png" alt="" className="h-11 w-11 rounded-2xl" />
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-medium text-mut">In your wallet</div>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="tabular-nums text-[26px] font-extrabold leading-none text-ink">
                {proof.toLocaleString()}
              </span>
              <span className="flex items-center gap-1 text-[13px] font-semibold text-mut">
                <img src="/proof-mark.png" alt="" className="h-auto w-[16px] shrink-0" /> $PROOF
              </span>
            </div>
          </div>
          {user?.wallet && (
            <a
              href={`https://explorer.solana.com/address/${user.wallet}/tokens?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
              className="flex shrink-0 items-center gap-1 text-[13px] font-medium text-ink2 transition-transform active:scale-95"
            >
              View <ExternalLink size={13} />
            </a>
          )}
        </div>
        {isWelcome && (
          <div className="relative mt-3 flex items-center gap-2 rounded-xl bg-grnsoft px-3 py-2">
            <Gift size={13} className="shrink-0 text-grn" />
            <p className="text-[12px] leading-snug text-grn">
              Your one-time welcome airdrop, real on-chain $PROOF. Play to earn more, then cash out to
              your wallet from the Earn tab.
            </p>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-[22px] border border-line bg-surface shadow-soft">
        <Row
          label="TxLINE + Solana"
          right={
            <a
              href="https://explorer.solana.com/?cluster=devnet"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-[13px] font-medium text-ink2"
            >
              devnet <ExternalLink size={13} />
            </a>
          }
        />
      </div>

      {user && (
        <button
          type="button"
          onClick={() => void disconnect()}
          className="rounded-full border border-line bg-surface py-3 text-[14px] font-semibold text-red shadow-soft active:scale-[0.98] transition-transform"
        >
          Sign out
        </button>
      )}
      <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 px-1 text-center text-[11px] text-mut">
        <span>Built on</span>
        <span className="inline-flex items-center rounded-md bg-white px-1.5 py-[3px] shadow-soft ring-1 ring-black/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/txline-logo.png" alt="TxLINE" className="h-3 w-auto" />
        </span>
        <span className="inline-flex items-center rounded-md bg-white px-1.5 py-[3px] shadow-soft ring-1 ring-black/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/solana-logo.svg" alt="Solana" className="h-3 w-auto" />
        </span>
        <span>· momentum trading for your favorite sports</span>
      </div>
    </div>
  );
}

function Row({ label, right, border }: { label: string; right: React.ReactNode; border?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-4 py-3.5 ${border ? "border-t border-line" : ""}`}>
      <span className="text-[14px] font-medium text-ink">{label}</span>
      {right}
    </div>
  );
}

async function commitOnChain(fixtureId: string) {
  const s = useStore.getState();
  if (!s.current) return;
  try {
    const res = await fetch("/api/predict/lock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId: fixtureId,
        marketId: s.current.id,
        wallet: s.user?.wallet,
        dir: s.current.dir,
        lockedProb: s.winProbHome,
      }),
    });
    const d = await res.json();
    useStore.getState().attachProof(d.memoSig, d.verifyUrl);
  } catch {
    /* demo continues without proof link */
  }
}
