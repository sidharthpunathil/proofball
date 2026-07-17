import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useStore } from "@/lib/store";

/**
 * The welcome airdrop must survive the prod cold-start race: a freshly-woken
 * serverless instance rejects its first Redis command (503), then succeeds warm.
 * signIn's claim retries that transient and always resolves to a visible outcome,
 * so a new wallet is never silently left at 0 $PROOF. These drive the real store
 * action with a mocked endpoint and fake timers to fast-forward the backoff.
 */

type Mode = "coldThenWarm" | "alwaysDown" | "warm";
let mode: Mode = "warm";
let airdropCalls = 0;

const res = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const granted = { airdropped: true, amount: 1000, balance: 1000, explorerUrl: "https://explorer/tx/abc" };

const mockFetch = vi.fn(async (url: string) => {
  if (url.startsWith("/api/leaderboard")) return res(200, { rows: [], me: null });
  if (url.startsWith("/api/reward/airdrop")) {
    airdropCalls++;
    if (mode === "warm") return res(200, granted);
    if (mode === "alwaysDown") return res(503, { error: "airdrop tracking unavailable" });
    // coldThenWarm: first call 503 (cold Redis), then the warm mint.
    return airdropCalls === 1 ? res(503, { error: "airdrop tracking unavailable" }) : res(200, granted);
  }
  return res(404, {});
});

beforeEach(() => {
  airdropCalls = 0;
  mode = "warm";
  vi.stubGlobal("fetch", mockFetch);
  useStore.setState({ user: null, welcome: null, proof: 0, coins: 500, streak: 0, leaderboard: [] });
});
afterEach(() => vi.unstubAllGlobals());

describe("welcome airdrop: cold-start resilience", () => {
  it("recovers a first-call 503 on a warm retry → granted toast + balance", async () => {
    mode = "coldThenWarm";
    vi.useFakeTimers();
    useStore.getState().signIn("Aa…Bb", "WALLET_COLD");
    await vi.runAllTimersAsync();
    vi.useRealTimers();

    const s = useStore.getState();
    expect(s.welcome).toEqual({ kind: "granted", amount: 1000, url: granted.explorerUrl });
    expect(s.proof).toBe(1000);
    expect(airdropCalls).toBe(2); // one cold 503, one warm success
  });

  it("mints on the first warm call with no retry", async () => {
    mode = "warm";
    vi.useFakeTimers();
    useStore.getState().signIn("Cc…Dd", "WALLET_WARM");
    await vi.runAllTimersAsync();
    vi.useRealTimers();

    expect(useStore.getState().welcome).toEqual({ kind: "granted", amount: 1000, url: granted.explorerUrl });
    expect(airdropCalls).toBe(1);
  });

  it("shows the error toast (not silent 0) only after retries are exhausted", async () => {
    mode = "alwaysDown";
    vi.useFakeTimers();
    useStore.getState().signIn("Ee…Ff", "WALLET_DOWN");
    await vi.runAllTimersAsync();
    vi.useRealTimers();

    expect(useStore.getState().welcome).toEqual({ kind: "error" });
    expect(airdropCalls).toBe(5); // initial + 4 retries
  });

  it("retryAirdrop re-claims and can succeed after an earlier failure", async () => {
    // Land in the error state first.
    mode = "alwaysDown";
    vi.useFakeTimers();
    useStore.getState().signIn("Gg…Hh", "WALLET_RETRY");
    await vi.runAllTimersAsync();
    vi.useRealTimers();
    expect(useStore.getState().welcome).toEqual({ kind: "error" });

    // The endpoint recovers; the user taps Retry.
    mode = "warm";
    airdropCalls = 0;
    vi.useFakeTimers();
    useStore.getState().retryAirdrop();
    await vi.runAllTimersAsync();
    vi.useRealTimers();

    expect(useStore.getState().welcome).toEqual({ kind: "granted", amount: 1000, url: granted.explorerUrl });
    expect(airdropCalls).toBe(1);
  });

  it("drops a stale result when the wallet switches mid-retry", async () => {
    mode = "coldThenWarm";
    vi.useFakeTimers();
    useStore.getState().signIn("Ii…Jj", "WALLET_A");
    // Switch account before the retry lands: the in-flight claim must not clobber it.
    useStore.setState({ user: { name: "Kk…Ll", wallet: "WALLET_B" } });
    await vi.runAllTimersAsync();
    vi.useRealTimers();

    // WALLET_A's claim resolved but was discarded (wallet no longer current).
    expect(useStore.getState().user?.wallet).toBe("WALLET_B");
    expect(useStore.getState().welcome).toBeNull();
  });
});
