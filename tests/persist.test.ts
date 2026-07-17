import { describe, it, expect } from "vitest";
import type { Prediction } from "@/lib/types";

// A minimal synchronous localStorage, installed on the global BEFORE the store
// module is imported so persist's storage factory (() => localStorage) resolves
// to it. This lets a node-env test exercise the real persistence path.
class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  get length() {
    return this.m.size;
  }
}

const mem = new MemStorage();
// The store guards persistence behind `typeof window !== "undefined"`, so give
// this node test a minimal window with our in-memory localStorage, installed
// before the store module is imported.
// @ts-expect-error test shim: node has no window
globalThis.window = { localStorage: mem };

const { useStore } = await import("@/lib/store");

const KEY = "proofball:v1";

const wonPick: Prediction = {
  id: "pick-1",
  prompt: "",
  createdAt: 0,
  lockAt: 0,
  settleAt: 0,
  dir: "up",
  lockedProb: 55,
  status: "won",
  delta: 5,
  reward: 10,
};

describe("store persistence — 'Your calls' survive a reload", () => {
  it("persists only the durable progress slice, never volatile match state", () => {
    useStore.setState({
      history: [wonPick],
      coins: 999,
      streak: 4,
      best: 7,
      // volatile — must be excluded by partialize:
      current: { ...wonPick, id: "in-flight" },
      events: [{ id: "e", action: "goal", team: "home", label: "", minute: 1, big: true }],
      user: { name: "n", wallet: "wallet-addr" },
      proof: 123,
    });

    const raw = mem.getItem(KEY);
    expect(raw).toBeTruthy();
    const { state } = JSON.parse(raw!);

    // durable progress is written
    expect(state.history).toHaveLength(1);
    expect(state.history[0].id).toBe("pick-1");
    expect(state.coins).toBe(999);
    expect(state.streak).toBe(4);
    expect(state.best).toBe(7);

    // live/volatile state is NOT written (this is what keeps a half-settled call
    // or a stale identity from resurrecting on reload)
    expect(state.current).toBeUndefined();
    expect(state.events).toBeUndefined();
    expect(state.user).toBeUndefined();
    expect(state.proof).toBeUndefined();
  });

  it("rehydrate() restores calls after a simulated reload (empty in-memory store)", async () => {
    // Simulate a fresh page load. Reset in-memory state FIRST (this itself writes
    // through to storage), THEN seed storage with the "prior session" — otherwise
    // the reset write would clobber the seed before rehydrate reads it.
    useStore.setState({ history: [], coins: 500, streak: 0, best: 0 });
    mem.setItem(
      KEY,
      JSON.stringify({ version: 1, state: { history: [wonPick], coins: 777, streak: 2, best: 3 } }),
    );

    await useStore.persist.rehydrate();

    const s = useStore.getState();
    expect(s.history).toHaveLength(1);
    expect(s.history[0].id).toBe("pick-1");
    expect(s.coins).toBe(777);
    expect(s.streak).toBe(2);
    expect(s.best).toBe(3);
  });
});
