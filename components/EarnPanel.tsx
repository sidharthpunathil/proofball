"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, m, useMotionValueEvent, useReducedMotion, useSpring } from "framer-motion";
import { useStore } from "@/lib/store";
import { listContainer, listItem, springSoft, tweenFast } from "@/lib/motion";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferCheckedInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
import CoinBurst from "@/components/fx/CoinBurst";
import CountUp from "@/components/fx/CountUp";
import Segmented from "@/components/Segmented";
import { PROOF, PROOF_DECIMALS } from "@/lib/economy";
import { Flame, Bullseye, Trophy, ShieldCheck, ArrowRight, ExternalLink, Check, Plus } from "./Icons";

export default function EarnPanel() {
  const coins = useStore((s) => s.coins);
  const refreshProof = useStore((s) => s.refreshProof);
  const streak = useStore((s) => s.streak);
  const best = useStore((s) => s.best);
  const board = useStore((s) => s.leaderboard);
  const rank = Math.max(1, board.findIndex((r) => r.you) + 1);
  const nextReward = 50 + Math.min(streak, 6) * 15;
  const reduce = useReducedMotion();

  // Fire a small coin burst on the balance the moment a WIN settles while the
  // Earn tab is mounted. `lastResult.n` bumps once per settlement; we replay the
  // burst only when that token advances (not on mount for a pre-existing win)
  // and only for wins.
  const lastResult = useStore((s) => s.lastResult);
  const [burstKey, setBurstKey] = useState(0);
  const seenN = useRef(lastResult?.n ?? null);
  useEffect(() => {
    const n = lastResult?.n ?? null;
    if (n === null || n === seenN.current) return;
    seenN.current = n;
    if (lastResult?.outcome === "won") setBurstKey((k) => k + 1);
  }, [lastResult]);

  // The hero shows your PLAYABLE $PROOF — the off-chain ledger the game runs on
  // ("$PROOF is the game"), the same number as the header pill and the leaderboard.
  // Refresh the wallet's real on-chain balance too, so the cash-out card's "in your
  // wallet" receipt is current when the tab opens.
  useEffect(() => {
    void refreshProof();
  }, [refreshProof]);

  // Smoothly count the balance to its new value when it changes mid-mount.
  const balanceSpring = useSpring(coins, springSoft);
  const [balanceDisplay, setBalanceDisplay] = useState(coins);
  useEffect(() => {
    if (reduce) {
      balanceSpring.jump(coins);
      setBalanceDisplay(coins);
    } else {
      balanceSpring.set(coins);
    }
  }, [coins, reduce, balanceSpring]);
  useMotionValueEvent(balanceSpring, "change", (v) => setBalanceDisplay(Math.round(v)));

  return (
    <m.div
      className="flex flex-col gap-4 px-4"
      variants={reduce ? undefined : listContainer}
      initial={reduce ? false : "hidden"}
      animate="show"
    >
      {/* balance hero */}
      <m.div variants={reduce ? undefined : listItem} className="relative rounded-[24px] border border-line bg-surface p-5 shadow-card">
        <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-mut">Your $PROOF</div>
        <div className="relative mt-1 flex items-end gap-2">
          <span className="text-[clamp(38px,11vw,52px)] font-extrabold leading-none tracking-[-0.03em] text-ink tabular-nums">
            {balanceDisplay.toLocaleString()}
          </span>
          <span className="mb-1.5 flex items-center gap-1 text-[16px] font-semibold text-mut">
            <img src="/proof-mark.png" alt="" className="h-auto w-[22px] shrink-0" /> $PROOF
          </span>
          {/* reward flourish: coins spray from the balance on a won call */}
          <CoinBurst fireKey={burstKey} count={6} size={12} />
        </div>
        <div className="mt-5 flex items-start gap-8 border-t border-line pt-4">
          <MiniStat value={`${streak}`} label="Streak" />
          <MiniStat
            value={<CountUp value={nextReward / 50} format={(v) => v.toFixed(1)} suffix="×" />}
            label="Multiplier"
            accent={nextReward > 50}
          />
          <MiniStat value={`#${rank}`} label="Rank" />
        </div>
      </m.div>

      {/* wallet bridge: top up (wallet → game) and cash out (game → wallet) */}
      <WalletCard />

      {/* how you earn */}
      <m.div variants={reduce ? undefined : listItem} className="rounded-[24px] border border-line bg-surface p-5 shadow-soft">
        <div className="text-[15px] font-semibold text-ink">How you earn</div>
        <div className="mt-4 flex flex-col gap-4">
          <Step
            n={1}
            icon={<Bullseye size={18} />}
            title="Call it right"
            body={`Predict which way the live win-probability moves. A right call wins +50 $PROOF; a wrong one costs ${PROOF.stake}, so your $PROOF moves every call.`}
          />
          <Step
            n={2}
            icon={<Flame size={18} />}
            title="Build a streak"
            body="Each call in a row raises your multiplier, up to 2.8× per correct call. Miss one and it resets."
          />
          <Step
            n={3}
            icon={<Trophy size={18} />}
            title="Top the leaderboard"
            body="The top of the weekly friends leaderboard splits the prize pool. Bragging rights included."
          />
        </div>
      </m.div>

      {/* fairness / model note */}
      <m.div variants={reduce ? undefined : listItem} className="flex items-start gap-3 rounded-[20px] border border-line bg-subtle p-4">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-grn" />
        <p className="text-[12.5px] leading-[1.55] text-ink2">
          <b className="text-ink">Free to play, provably fair.</b> $PROOF costs nothing, every settlement is
          verified against on-chain World Cup data. Prize pools run on a small rake; premium unlocks extra
          markets.
        </p>
      </m.div>
    </m.div>
  );
}

// The wallet bridge, both directions of the "$PROOF is the game" ramp:
//   • Top up   (wallet → game): the player signs ONE real on-chain $PROOF transfer
//     into the game treasury; the server verifies it and we credit the playable
//     ledger. A deposit spends the player's own tokens, so this is the one place a
//     signature is legitimately required.
//   • Cash out (game → wallet): optimistically debit the playable ledger, mint an
//     equal amount of real $PROOF into the wallet (1:1). No signature — receiving
//     never needs one.
// The fast gameplay loop stays signature-free; only these deliberate ramps touch
// the chain. The live on-chain wallet balance is the shared receipt at the bottom.
const CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "devnet";
const addrUrl = (a: string) => `https://explorer.solana.com/address/${a}?cluster=${CLUSTER}`;
const txUrl = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=${CLUSTER}`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Mode = "topup" | "cashout";

function WalletCard() {
  const coins = useStore((s) => s.coins); // playable ledger
  const proof = useStore((s) => s.proof); // real on-chain wallet balance
  const wallet = useStore((s) => s.user?.wallet);
  const cashOut = useStore((s) => s.cashOut);
  const applyDeposit = useStore((s) => s.applyDeposit);
  const reduce = useReducedMotion();

  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const [mode, setMode] = useState<Mode>("topup");
  const isTop = mode === "topup";
  const max = isTop ? proof : coins; // most you can move in this direction
  const min = isTop ? PROOF.topup.min : PROOF.cashout.min;
  const canAct = max >= min;
  const snap = (n: number) => Math.max(min, Math.min(max, Math.round(n / 10) * 10));

  const [amount, setAmount] = useState(() => Math.max(PROOF.topup.min, Math.round((proof * 0.25) / 10) * 10));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ moved: number; url?: string; dir: Mode } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [burstKey, setBurstKey] = useState(0);

  // Reset the amount to a sensible default on a mode switch (25% of that side's
  // balance); on a plain balance change, just re-clamp the current pick.
  const prevMode = useRef(mode);
  useEffect(() => {
    const switched = prevMode.current !== mode;
    prevMode.current = mode;
    setAmount((a) => Math.max(min, Math.min(max, Math.round((switched ? max * 0.25 : a) / 10) * 10)));
    if (switched) {
      setDone(null);
      setError(null);
    }
  }, [mode, max, min]);

  const pick = (v: number) => {
    setAmount(snap(v));
    setDone(null);
    setError(null);
  };

  // Top up: build + send the SPL transfer from the wallet to the treasury, then
  // poll the verify route (which reads the confirmed tx from the chain) until it
  // credits the ledger. Returns a user-facing result.
  const topUp = async (amt: number): Promise<{ ok: boolean; moved?: number; url?: string; error?: string }> => {
    if (!publicKey || !wallet) return { ok: false, error: "Connect your wallet to top up" };
    let treasury: string, mintStr: string;
    try {
      const cfg = await fetch("/api/topup").then((r) => r.json());
      treasury = String(cfg.treasury);
      mintStr = String(cfg.mint);
      new PublicKey(treasury);
      new PublicKey(mintStr);
    } catch {
      return { ok: false, error: "Top up is unavailable right now" };
    }

    let signature: string;
    try {
      const mint = new PublicKey(mintStr);
      const owner = new PublicKey(treasury);
      const fromAta = await getAssociatedTokenAddress(mint, publicKey);
      const toAta = await getAssociatedTokenAddress(mint, owner);
      const base = BigInt(amt) * BigInt(10) ** BigInt(PROOF_DECIMALS);
      const tx = new Transaction().add(
        // Create the treasury's token account if it doesn't exist yet (payer = the
        // depositor); idempotent, so it's a no-op once it exists.
        createAssociatedTokenAccountIdempotentInstruction(publicKey, toAta, owner, mint),
        createTransferCheckedInstruction(fromAta, mint, toAta, publicKey, base, PROOF_DECIMALS)
      );
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;
      signature = await sendTransaction(tx, connection);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      // Wallet rejections read as a cancel, not an error.
      if (/reject|denied|cancel/i.test(msg)) return { ok: false, error: "Top up cancelled" };
      return { ok: false, error: "Couldn't send the transfer" };
    }

    // Verify + credit. The tx may not be queryable the instant it's sent, so poll
    // through the route's { pending } responses.
    for (let i = 0; i < 12; i++) {
      try {
        const res = await fetch("/api/topup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet, signature }),
        });
        const d = (await res.json().catch(() => null)) as
          | { ok?: boolean; credited?: number; pending?: boolean; error?: string }
          | null;
        if (res.ok && d?.ok) return { ok: true, moved: d.credited ?? amt, url: txUrl(signature) };
        if (res.status === 202 || d?.pending) {
          await wait(1600);
          continue;
        }
        return { ok: false, error: d?.error || "Couldn't verify your deposit" };
      } catch {
        await wait(1600);
      }
    }
    // The transfer likely landed; the confirmation just outran us. Refresh so the
    // balances settle, and tell the player to check the tx.
    return { ok: false, error: "Still confirming your deposit — check the transaction." };
  };

  const submit = async () => {
    if (busy || !canAct) return;
    setBusy(true);
    setError(null);
    setDone(null);
    if (isTop) {
      const r = await topUp(amount);
      setBusy(false);
      if (r.ok) {
        applyDeposit(r.moved ?? amount);
        setDone({ moved: r.moved ?? amount, url: r.url, dir: "topup" });
        setBurstKey((k) => k + 1);
      } else {
        setError(r.error ?? "Top up failed");
      }
    } else {
      const r = await cashOut(amount);
      setBusy(false);
      if (r.ok) {
        setDone({ moved: r.minted ?? amount, url: r.explorerUrl, dir: "cashout" });
        setBurstKey((k) => k + 1);
      } else {
        setError(r.error ?? "Cash out failed");
      }
    }
  };

  const presets = [
    { label: "25%", v: max * 0.25 },
    { label: "50%", v: max * 0.5 },
    { label: "Max", v: max },
  ];
  const walletUrl = wallet ? addrUrl(wallet) : undefined;
  const cta = busy
    ? isTop
      ? "Topping up…"
      : "Cashing out…"
    : `${isTop ? "Top up" : "Cash out"} ${amount.toLocaleString()} $PROOF`;

  return (
    <m.div
      variants={reduce ? undefined : listItem}
      className="rounded-[24px] border border-line bg-surface p-5 shadow-soft"
    >
      <Segmented<Mode>
        options={[
          { value: "topup", label: "Top up" },
          { value: "cashout", label: "Cash out" },
        ]}
        value={mode}
        onChange={setMode}
        layoutId="wallet-mode"
        variant="soft"
        ariaLabel="Top up or cash out"
      />
      <div className="mt-3 text-[12.5px] leading-[1.5] text-ink2">
        {isTop
          ? "Move real $PROOF from your wallet into the game to play with. One wallet signature."
          : "Move your $PROOF on-chain as real tokens you hold in your own wallet."}
      </div>

      {canAct ? (
        <>
          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-mut">Amount</div>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="text-[30px] font-extrabold leading-none tracking-[-0.02em] text-ink tabular-nums">
                  {amount.toLocaleString()}
                </span>
                <span className="flex items-center gap-1 text-[13px] font-semibold text-mut">
                  <img src="/proof-mark.png" alt="" className="h-auto w-[16px] shrink-0" /> $PROOF
                </span>
              </div>
            </div>
            <div className="flex gap-1.5">
              {presets.map((p) => {
                const active = snap(p.v) === amount;
                return (
                  <button
                    key={p.label}
                    onClick={() => pick(p.v)}
                    className={`rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                      active
                        ? "border-transparent bg-ink text-bg"
                        : "border-line bg-subtle text-ink2 hover:border-line2"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <input
            type="range"
            min={min}
            max={max}
            step={10}
            value={amount}
            onChange={(e) => pick(Number(e.target.value))}
            aria-label={isTop ? "Amount of $PROOF to top up" : "Amount of $PROOF to cash out"}
            className="mt-3 w-full accent-amber"
          />
          <div className="mt-1 flex justify-between text-[11px] tabular-nums text-mut">
            <span>{min.toLocaleString()} min</span>
            <span>{max.toLocaleString()} max</span>
          </div>

          <button
            onClick={submit}
            disabled={busy}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-3 text-[14px] font-bold text-bg transition-transform active:scale-[0.99] disabled:opacity-60"
          >
            {!busy && (isTop ? <Plus size={16} strokeWidth={2.6} /> : <ArrowRight size={16} strokeWidth={2.6} />)}
            {cta}
          </button>
        </>
      ) : (
        <div className="mt-4 rounded-2xl border border-line bg-subtle px-4 py-3 text-[12.5px] leading-[1.5] text-ink2">
          {isTop ? (
            <>No $PROOF in your wallet to top up yet. Cash out some winnings first, or claim your welcome airdrop.</>
          ) : (
            <>
              Earn at least <b className="text-ink">{min.toLocaleString()} $PROOF</b> by making calls, then cash
              out to your wallet.
            </>
          )}
        </div>
      )}

      <AnimatePresence mode="wait">
        {done ? (
          <m.div
            key="done"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={tweenFast}
            className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] font-medium text-grn"
          >
            <span className="inline-flex items-center gap-1.5">
              <Check size={15} strokeWidth={2.5} />
              {done.dir === "topup"
                ? `Added ${done.moved.toLocaleString()} $PROOF to the game.`
                : `Sent ${done.moved.toLocaleString()} $PROOF to your wallet.`}
            </span>
            {done.url && (
              <a
                href={done.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 text-mut transition-colors hover:text-ink"
              >
                View tx <ExternalLink size={12} />
              </a>
            )}
          </m.div>
        ) : error ? (
          <m.div
            key="err"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={tweenFast}
            className="mt-3 text-[12.5px] font-medium text-red"
          >
            {error}
          </m.div>
        ) : null}
      </AnimatePresence>

      {/* receipt: your real on-chain wallet balance, count-up animated so a ramp
          visibly lands. Coins spray into it on success. */}
      <div className="relative mt-4 flex items-center justify-between border-t border-line pt-3.5">
        <CoinBurst fireKey={burstKey} count={7} size={12} />
        <span className="text-[12px] font-medium text-mut">In your wallet</span>
        <span className="flex items-center gap-1.5">
          <span className="tabular-nums text-[13px] font-bold text-ink">
            <CountUp value={proof} />{" "}
            <span className="inline-flex items-center gap-1 align-middle font-semibold text-mut">
              <img src="/proof-mark.png" alt="" className="h-auto w-[15px] shrink-0" /> $PROOF
            </span>
          </span>
          {walletUrl && (
            <a
              href={walletUrl}
              target="_blank"
              rel="noreferrer"
              className="text-mut transition-transform hover:text-ink active:scale-90"
              aria-label="View your $PROOF on the Solana explorer"
            >
              <ExternalLink size={13} />
            </a>
          )}
        </span>
      </div>
    </m.div>
  );
}

// A single flat stat under the balance — value over a small uppercase label, no
// tile, no icon. `accent` tints the value green (the multiplier when a streak is
// live), the one bit of colour in an otherwise monochrome, minimal row.
function MiniStat({
  value,
  label,
  accent,
}: {
  value: React.ReactNode;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span
        className={`text-[22px] font-extrabold leading-none tracking-[-0.01em] tabular-nums transition-colors ${
          accent ? "text-grn" : "text-ink"
        }`}
      >
        {value}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-mut">{label}</span>
    </div>
  );
}

function Step({
  n,
  icon,
  title,
  body,
}: {
  n: number;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-3.5">
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-subtle text-ink">
        {icon}
        <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[11px] font-bold text-bg">
          {n}
        </span>
      </div>
      <div className="min-w-0">
        <div className="text-[14px] font-semibold text-ink">{title}</div>
        <div className="mt-0.5 text-[12.5px] leading-[1.5] text-ink2">{body}</div>
      </div>
    </div>
  );
}
