import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "@/lib/store";
import type { OddsFrame } from "@/lib/types";

const odds = (home: number, draw = 20, away?: number): OddsFrame => ({
  kind: "odds",
  PriceNames: ["1", "X", "2"],
  Pct: [String(home), String(draw), String(away ?? 100 - home - draw)],
  SuperOddsType: "1X2",
  delay: 0,
});

function reset() {
  useStore.setState({
    user: null,
    coins: 500,
    streak: 0,
    best: 0,
    current: null,
    history: [],
    lastSettleAt: 0,
    winProbHome: 50,
    drawProb: 27,
    awayProb: 23,
    probHistory: [],
    events: [],
    scoreH: 0,
    scoreA: 0,
  });
}

describe("prediction flow: open → pick → lock → settle", () => {
  beforeEach(reset);

  it("ingesting odds updates win-probability + history", () => {
    const s = useStore.getState();
    s.ingest(odds(58, 24, 18));
    const after = useStore.getState();
    expect(after.winProbHome).toBe(58);
    expect(after.probHistory.at(-1)).toBe(58);
  });

  it("a correct 'rising' call wins coins and grows the streak", () => {
    const s = useStore.getState();
    s.signIn("tester");
    s.ingest(odds(55));
    const t0 = 1_000_000;
    s.openMarket(t0);
    useStore.getState().setPick("up");
    useStore.getState().lockMarket(t0);

    let cur = useStore.getState().current!;
    expect(cur.status).toBe("locked");
    expect(cur.lockedProb).toBe(55);

    // market rises, then settle window elapses
    useStore.getState().ingest(odds(63));
    useStore.getState().settleMarket(cur.settleAt! + 1);

    const end = useStore.getState();
    expect(end.current).toBeNull();
    expect(end.history[0].status).toBe("won");
    expect(end.history[0].delta).toBeCloseTo(8, 1);
    expect(end.streak).toBe(1);
    expect(end.coins).toBeGreaterThan(500);
  });

  it("a wrong call loses and resets the streak", () => {
    const s = useStore.getState();
    s.signIn("tester");
    useStore.setState({ streak: 3 });
    s.ingest(odds(60));
    const t0 = 2_000_000;
    s.openMarket(t0);
    useStore.getState().setPick("up"); // bet rising…
    useStore.getState().lockMarket(t0);
    useStore.getState().ingest(odds(51)); // …but it falls
    const cur = useStore.getState().current!;
    useStore.getState().settleMarket(cur.settleAt! + 1);

    const end = useStore.getState();
    expect(end.history[0].status).toBe("lost");
    expect(end.streak).toBe(0);
    expect(end.coins).toBe(480); // wrong call loses the 20-coin stake (500 → 480)
  });

  it("a 'falling' call wins when probability drops", () => {
    const s = useStore.getState();
    s.signIn("tester");
    s.ingest(odds(60));
    const t0 = 3_000_000;
    s.openMarket(t0);
    useStore.getState().setPick("down");
    useStore.getState().lockMarket(t0);
    useStore.getState().ingest(odds(52));
    const cur = useStore.getState().current!;
    useStore.getState().settleMarket(cur.settleAt! + 1);
    expect(useStore.getState().history[0].status).toBe("won");
  });

  it("streak multiplier increases the reward", () => {
    const s = useStore.getState();
    s.signIn("tester");

    const runWin = (t: number) => {
      s.ingest(odds(55));
      useStore.getState().openMarket(t);
      useStore.getState().setPick("up");
      useStore.getState().lockMarket(t);
      useStore.getState().ingest(odds(65));
      const cur = useStore.getState().current!;
      useStore.getState().settleMarket(cur.settleAt! + 1);
      return useStore.getState().history[0].reward!;
    };

    const first = runWin(10_000_000);
    const second = runWin(20_000_000);
    expect(second).toBeGreaterThan(first); // streak 2 pays more than streak 1
  });

  it("an unanswered market is skipped, not settled", () => {
    const s = useStore.getState();
    s.signIn("tester");
    s.openMarket(5_000_000);
    expect(useStore.getState().current).not.toBeNull();
    useStore.getState().skipMarket();
    expect(useStore.getState().current).toBeNull();
    expect(useStore.getState().history).toHaveLength(0);
  });

  it("cannot open a market without signing in", () => {
    reset();
    useStore.getState().openMarket(1);
    expect(useStore.getState().current).toBeNull();
  });

  it("goal events flash the needle and push onto the feed", () => {
    const s = useStore.getState();
    const before = useStore.getState().flashKey;
    s.ingest({
      kind: "score",
      action: "goal",
      team: "home",
      label: "⚽ GOAL",
      scoreH: 1,
      scoreA: 0,
      minute: 23,
      seq: 5,
      delay: 0,
    });
    const after = useStore.getState();
    expect(after.flashKey).toBe(before + 1);
    expect(after.scoreH).toBe(1);
    expect(after.events[0].big).toBe(true);
  });
});
