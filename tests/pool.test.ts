import { describe, it, expect } from "vitest";
import { settlePool, type Entry } from "@/lib/pool";

describe("settlePool (parimutuel)", () => {
  it("5 players, 3 winners: winners split the 25 pool proportionally", () => {
    const entries: Entry[] = [
      { wallet: "a", dir: "up", stake: 5 },
      { wallet: "b", dir: "up", stake: 5 },
      { wallet: "c", dir: "up", stake: 5 },
      { wallet: "d", dir: "down", stake: 5 },
      { wallet: "e", dir: "down", stake: 5 },
    ];
    const s = settlePool(entries, "up");
    expect(s.pool).toBe(25);
    expect(s.winners).toBe(3);
    const a = s.payouts.find((p) => p.wallet === "a")!;
    expect(a.payout).toBeCloseTo(8.33, 1); // 25 / 3
    expect(a.profit).toBeCloseTo(3.33, 1);
    expect(s.payouts.find((p) => p.wallet === "d")!.payout).toBe(0); // loser forfeits
  });

  it("a SOL entry (2x stake) takes a bigger share of the pool", () => {
    const entries: Entry[] = [
      { wallet: "sol", dir: "up", stake: 10 }, // paid in SOL, 2x share
      { wallet: "p", dir: "up", stake: 5 },
      { wallet: "l", dir: "down", stake: 5 },
    ];
    const s = settlePool(entries, "up"); // pool 20, winning stake 15
    expect(s.payouts.find((x) => x.wallet === "sol")!.payout).toBeCloseTo(13.33, 1); // 10/15*20
    expect(s.payouts.find((x) => x.wallet === "p")!.payout).toBeCloseTo(6.67, 1); // 5/15*20
  });

  it("no winners refunds everyone", () => {
    const s = settlePool([{ wallet: "a", dir: "up", stake: 5 }], "down");
    expect(s.refunded).toBe(true);
    expect(s.payouts[0].payout).toBe(5);
  });

  it("a push refunds everyone", () => {
    const s = settlePool(
      [
        { wallet: "a", dir: "up", stake: 5 },
        { wallet: "b", dir: "down", stake: 5 },
      ],
      "push",
    );
    expect(s.refunded).toBe(true);
    expect(s.payouts.every((p) => p.payout === p.stake)).toBe(true);
  });
});
