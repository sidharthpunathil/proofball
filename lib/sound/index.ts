// Public sound API for ProofBall.
//
//   import { playSound } from "@/lib/sound";      // fire a sound from anywhere
//   const { play, muted, toggleMuted } = useSound(); // React-aware in components
//
// Everything is a no-op until the engine is unlocked by a real user gesture
// (SoundLayer installs the unlock listener) and while muted. Safe on the server.

import { useCallback, useSyncExternalStore } from "react";
import { engine } from "./engine";
import { playSound, type PlayOpts, type SoundName } from "./sounds";

export { engine, playSound };
export type { PlayOpts, SoundName };

/** Imperative handle for non-React call sites. */
export const sound = {
  play: playSound,
  unlock: () => engine.unlock(),
  get muted() {
    return engine.muted;
  },
  setMuted: (v: boolean) => engine.setMuted(v),
  toggle: () => engine.toggleMuted(),
};

/** Subscribe to the mute flag (re-renders on change). */
export function useMuted(): boolean {
  return useSyncExternalStore(
    (cb) => engine.subscribe(cb),
    () => engine.muted,
    () => false, // server: nothing plays anyway; render the "sound on" affordance
  );
}

/** Convenience hook for components: a stable play() plus reactive mute state. */
export function useSound() {
  const muted = useMuted();
  const play = useCallback((name: SoundName, opts?: PlayOpts) => playSound(name, opts), []);
  const toggleMuted = useCallback(() => engine.toggleMuted(), []);
  const setMuted = useCallback((v: boolean) => engine.setMuted(v), []);
  const unlock = useCallback(() => engine.unlock(), []);
  return { play, muted, toggleMuted, setMuted, unlock };
}
