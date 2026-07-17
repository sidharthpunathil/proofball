import { describe, it, expect } from "vitest";
import { buildCommitment, type CommitInput } from "@/lib/commit";

const base: CommitInput = {
  matchId: "featured",
  marketId: "m1",
  wallet: "AbC…9xY",
  dir: "up",
  lockedProb: 62,
  ts: 1_752_000_000_000,
};

describe("on-chain commitment", () => {
  it("is deterministic for the same input + salt", () => {
    const a = buildCommitment(base, "fixedsalt");
    const b = buildCommitment(base, "fixedsalt");
    expect(a.commitment).toBe(b.commitment);
    expect(a.commitment).toHaveLength(64); // sha256 hex
    expect(a.tag.startsWith("proofball:v1:")).toBe(true);
    expect(a.memoSig).toHaveLength(16);
  });

  it("changes if any field changes (tamper-evident)", () => {
    const a = buildCommitment(base, "fixedsalt");
    const changedPick = buildCommitment({ ...base, dir: "down" }, "fixedsalt");
    const changedProb = buildCommitment({ ...base, lockedProb: 63 }, "fixedsalt");
    expect(changedPick.commitment).not.toBe(a.commitment);
    expect(changedProb.commitment).not.toBe(a.commitment);
  });

  it("uses a random salt when none is given", () => {
    const a = buildCommitment(base);
    const b = buildCommitment(base);
    expect(a.salt).not.toBe(b.salt);
    expect(a.commitment).not.toBe(b.commitment);
  });
});
