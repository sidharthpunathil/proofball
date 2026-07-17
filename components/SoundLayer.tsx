"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { engine, playSound } from "@/lib/sound";

/**
 * The reactive sound layer. Renders nothing; it does two jobs:
 *
 *  1. Unlocks the AudioContext on the first real user gesture (browser autoplay
 *     policy — audio can't start until the user touches the page).
 *  2. Subscribes to the game store and plays the matching sound on each state
 *     *edge* (market open/lock, win/loss settle, welcome airdrop, big match
 *     event, leaderboard climb). Gesture-tight sounds (pick, nav, theme) fire
 *     from their own handlers instead — this layer owns the derived ones.
 *
 * Mounted once, near the app root.
 */
export default function SoundLayer() {
  useEffect(() => {
    const unlock = () => engine.unlock();
    const opts: AddEventListenerOptions = { passive: true };
    window.addEventListener("pointerdown", unlock, opts);
    window.addEventListener("keydown", unlock, opts);
    window.addEventListener("touchstart", unlock, opts);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  useEffect(() => {
    const unsub = useStore.subscribe((s, prev) => {
      // A fresh market opened → soft "ready" blip.
      if (!prev.current && s.current?.status === "open") playSound("open");

      // Pick committed on-chain (open → locked) → mechanical latch.
      if (prev.current?.status === "open" && s.current?.status === "locked") playSound("lock");

      // Settlement outcome (lastResult token bumps once per settle).
      const r = s.lastResult;
      if (r && r.n !== (prev.lastResult?.n ?? 0)) {
        if (r.outcome === "won") {
          playSound("win", { level: r.streak });
          playSound("coin");
          if (r.newBest) window.setTimeout(() => playSound("best"), 280);
          else if (r.streak >= 2) window.setTimeout(() => playSound("streakUp", { level: r.streak }), 130);
        } else {
          playSound("lose", { big: r.brokeStreak });
        }
      }

      // First-connect welcome airdrop → the app's richest cue.
      if (!prev.welcome && s.welcome) playSound("welcome");

      // Big match event (goal / red card) rides the existing needle flash.
      if (s.lastEvent && s.lastEvent.id !== prev.lastEvent?.id && s.lastEvent.big) {
        playSound(s.lastEvent.action === "red_card" ? "redCard" : "goal");
      }

      // Your leaderboard row climbed. Gate strictly to YOUR row moving up so the
      // 5s poll's constant reshuffles stay silent; a bigger swell on top-3 entry.
      const yiPrev = prev.leaderboard.findIndex((x) => x.you);
      const yiNow = s.leaderboard.findIndex((x) => x.you);
      if (yiPrev > 0 && yiNow >= 0 && yiNow < yiPrev) {
        if (yiNow < 3 && yiPrev >= 3) playSound("milestone");
        else playSound("rankUp");
      }
    });
    return unsub;
  }, []);

  return null;
}
