"use client";

import { useEffect, useState } from "react";
import { m, AnimatePresence, useReducedMotion } from "framer-motion";
import { playSound } from "@/lib/sound";
import { springPop, tweenFast, DUR, EASE_OUT } from "@/lib/motion";
import { Play, Expand, Close } from "./Icons";

/**
 * The lobby's demo-video card: a branded facade that swaps to the Vimeo player
 * only on tap. The facade is pure local DOM, so visitors who never press play
 * load zero Vimeo JS; pressing play mounts the iframe with autoplay.
 *
 * The corner Expand button opens THEATER MODE: a near-fullscreen lightbox
 * player, since the inline card is deliberately small (max-w-md on desktop).
 * Opening it unmounts the inline player so audio never doubles up; Escape,
 * the close button, or the backdrop dismiss it.
 */
const VIMEO_ID = "1210999911";

const playerSrc = `https://player.vimeo.com/video/${VIMEO_ID}?autoplay=1&title=0&byline=0&portrait=0&dnt=1`;

export default function DemoVideo() {
  const [playing, setPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const reduce = useReducedMotion();

  const openTheater = () => {
    playSound("press");
    setPlaying(false); // never two players talking at once
    setExpanded(true);
  };

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  return (
    <>
      <div
        className={`relative mt-5 aspect-video w-full overflow-hidden rounded-[22px] border shadow-card lg:max-w-md ${
          // Once the player is up, the card must disappear into it: the light
          // border + surface bg read as white hairlines around Vimeo's black.
          playing ? "border-black bg-black" : "border-line bg-surface"
        }`}
      >
        <AnimatePresence initial={false}>
          {playing ? (
            <m.iframe
              key="player"
              src={playerSrc}
              className="absolute inset-0 h-full w-full"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              title="ProofBall demo video"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={tweenFast}
            />
          ) : (
            <m.button
              key="facade"
              type="button"
              onClick={() => {
                playSound("press");
                setPlaying(true);
              }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, transition: tweenFast }}
              className="group absolute inset-0 flex flex-col items-center justify-center gap-3"
              style={{
                background:
                  "radial-gradient(120% 160% at 15% 0%, rgb(var(--grn) / 0.16), transparent 55%), radial-gradient(120% 160% at 100% 100%, rgb(var(--grn) / 0.08), transparent 60%)",
              }}
              aria-label="Play the ProofBall demo video"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/proofball-logo.png"
                alt=""
                aria-hidden
                className="pointer-events-none absolute left-4 top-4 h-8 w-8 rounded-[10px] opacity-90 shadow-soft"
              />
              <m.span
                whileTap={reduce ? undefined : { scale: 0.92 }}
                transition={springPop}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-ink text-bg shadow-btn transition-transform motion-safe:group-hover:scale-105"
              >
                <Play size={22} className="ml-0.5" />
              </m.span>
              <span className="text-[13.5px] font-semibold text-ink">Watch the demo</span>
            </m.button>
          )}
        </AnimatePresence>

        {/* Theater: watch it big. Sits above facade and player alike; Vimeo's
            own controls live at the bottom, so a top-right corner chip never
            covers them. */}
        <button
          type="button"
          onClick={openTheater}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white backdrop-blur-sm transition-transform active:scale-[0.92] motion-safe:hover:scale-105"
          title="Watch bigger"
          aria-label="Watch the demo in a bigger player"
        >
          <Expand size={14} />
        </button>
      </div>

      {/* Theater mode: near-fullscreen lightbox player. */}
      <AnimatePresence>
        {expanded && (
          <m.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: DUR.fast, ease: EASE_OUT } }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
            onClick={() => setExpanded(false)}
          >
            <m.div
              // Largest 16:9 box that fits: 94% of the width, 90% of the height
              // (90vh * 16/9 = 160vh), capped for very wide screens.
              style={{ width: "min(94vw, 160vh, 1280px)" }}
              className="relative aspect-video overflow-hidden rounded-2xl bg-black shadow-card"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, transition: { duration: DUR.fast, ease: EASE_OUT } }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
              onClick={(e) => e.stopPropagation()}
            >
              <iframe
                src={playerSrc}
                className="absolute inset-0 h-full w-full"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                title="ProofBall demo video"
              />
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white backdrop-blur-sm transition-transform active:scale-[0.92] motion-safe:hover:scale-105"
                aria-label="Close the video"
              >
                <Close size={16} />
              </button>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </>
  );
}
