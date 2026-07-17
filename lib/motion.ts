// Shared motion tokens for ProofBall.
//
// Keep these in sync with the CSS keyframes/easings in globals.css and
// tailwind.config.ts so that JS-driven (framer-motion) and CSS-driven motion
// read as one consistent system. Prefer importing from here over re-inlining
// magic numbers, so the whole app can be retuned from a single place.
import type { Transition } from "framer-motion";

/** Ease-out expo, the app's signature "settle" curve (enters, expands, arc fill). */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;
/** Symmetric ease for cross-fades (theme/color transitions). */
export const EASE_INOUT = [0.65, 0, 0.35, 1] as const;
/** Slight overshoot for playful pops (badges, confirmations). Use sparingly. */
export const EASE_BACK = [0.34, 1.56, 0.64, 1] as const;

/** Durations in seconds. Motion should be quick; most UI lives in 0.12-0.3s. */
export const DUR = {
  micro: 0.12, // taps, hovers, icon swaps
  fast: 0.2, // most enters/exits
  base: 0.28, // panels, cards, list items
  slow: 0.5, // large reveals, the win-prob arc fill
} as const;

/** Soft spring: matches the needle + counting number already in the app. */
export const springSoft: Transition = { type: "spring", stiffness: 200, damping: 25 };
/** Snappy spring: for controls that should feel responsive but settled. */
export const springSnappy: Transition = { type: "spring", stiffness: 420, damping: 34, mass: 0.8 };
/** Pop spring: brief overshoot for appearing badges/confirmations. */
export const springPop: Transition = { type: "spring", stiffness: 520, damping: 26, mass: 0.7 };

/** Standard tweens for enters/exits. */
export const tweenBase: Transition = { duration: DUR.base, ease: EASE_OUT };
export const tweenFast: Transition = { duration: DUR.fast, ease: EASE_OUT };

/** Staggered-list helper: children fade/rise in sequence. */
export const listContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.02 } },
};
export const listItem = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: tweenFast },
};
