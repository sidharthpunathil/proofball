import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useStore } from "@/lib/store";

/**
 * The welcome airdrop must survive the prod cold-start race: a freshly-woken
 * serverless instance rejects its first Redis command (503), then succeeds warm.
 * signIn's claim retries that transient and always resolves to a visible outcome,
 * so a new wallet is never silently left at 0 $PROOF. It must ALSO not cry
 * "couldn't load" for a wallet that already holds its airdrop but whose claim POST
 * was rate-limited (429) — it falls back to a (non-rate-limited) balance read.
 */

type Mode = "coldThenWarm" | "alwaysDown" | "warm" | "rateLimited";
let mode: Mode = "warm";
let funded = false; // what the GET balance read reports
let airdropCalls = 0; // POST claims only (GET balance reads are not counted)

const res = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const granted = { airdropped: true, amount: 1000, balance: 1000, explorerUrl: "https://explorer/tx/abc" };

const mockFetch = vi.fn(async (url: string, init?: { method?: string }) => {
  if (url.startsWith("/api/leaderboard")) return res(200, { rows: [], me: null });
  if (url.startsWith("/api/reward/airdrop")) {
    if ((init?.method ?? "GET") !== "POST") {
      // Balance read (resolveAirdropOutcome) — never rate-limited.
      return res(200, { balance: funded ? 1000 : 0 });
    }
    airdropCalls++;
    if (mode === "warm") return res(200, granted);
    if (mode === "alwaysDown") return res(503, { error: "airdrop tracking unavailable" });
    if (mode === "rateLimited") return res(429, { error: "rate limited, try later" });
    // coldThenWarm: first call 503 (cold Redis), then the warm mint.
    return airdropCalls === 1 ? res(503, { error: "airdrop tracking unavailable" }) : res(200, granted);
  }
  return res(404, {});
});

beforeEach(() => {
  airdropCalls = 0;
  mode = "warm";
  funded = false;
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

  it("shows the error toast (not silent 0) only after retries, when truly unfunded", async () => {
    mode = "alwaysDown";
    funded = false;
    vi.useFakeTimers();
    useStore.getState().signIn("Ee…Ff", "WALLET_DOWN");
    await vi.runAllTimersAsync();
    vi.useRealTimers();

    expect(useStore.getState().welcome).toEqual({ kind: "error" });
    expect(airdropCalls).toBe(5); // initial + 4 retries (GET balance not counted)
  });

  it("does NOT error when the claim is rate-limited but the wallet is already funded", async () => {
    mode = "rateLimited"; // 429 → non-retryable
    funded = true; // the balance read shows it already holds the airdrop
    vi.useFakeTimers();
    useStore.getState().signIn("Gg…Hh", "WALLET_FUNDED_429");
    await vi.runAllTimersAsync();
    vi.useRealTimers();

    const s = useStore.getState();
    expect(s.welcome).toBeNull(); // no "couldn't load" — it's already funded
    expect(s.proof).toBe(1000);
    expect(airdropCalls).toBe(1); // one 429, no retries
  });

  it("still errors when rate-limited AND genuinely unfunded", async () => {
    mode = "rateLimited";
    funded = false;
    vi.useFakeTimers();
    useStore.getState().signIn("Ii…Jj", "WALLET_UNFUNDED_429");
    await vi.runAllTimersAsync();
    vi.useRealTimers();

    expect(useStore.getState().welcome).toEqual({ kind: "error" });
  });

  it("retryAirdrop re-claims and can succeed after an earlier failure", async () => {
    mode = "alwaysDown";
    funded = false;
    vi.useFakeTimers();
    useStore.getState().signIn("Kk…Ll", "WALLET_RETRY");
    await vi.runAllTimersAsync();
    vi.useRealTimers();
    expect(useStore.getState().welcome).toEqual({ kind: "error" });

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
    useStore.getState().signIn("Mm…Nn", "WALLET_A");
    useStore.setState({ user: { name: "Oo…Pp", wallet: "WALLET_B" } });
    await vi.runAllTimersAsync();
    vi.useRealTimers();

    expect(useStore.getState().user?.wallet).toBe("WALLET_B");
    expect(useStore.getState().welcome).toBeNull();
  });
});
