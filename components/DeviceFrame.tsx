"use client";

/**
 * DeviceFrame
 *
 * ProofBall is a mobile-first app: every screen is a narrow `max-w-md` column.
 * On a real phone that IS the app, so we render the children untouched. On a
 * desktop viewport that lonely column looks unfinished, so from `lg` (1024px)
 * up we wrap the exact same DOM inside a to-scale iPhone: titanium frame,
 * Dynamic Island, iOS status bar and side buttons, floating on an ambient desk.
 *
 * There is no viewport branching in JS: the framing is done entirely in CSS
 * (see the "Device frame" block in app/globals.css), so the markup is
 * SSR-stable with no hydration flash and the app renders exactly once.
 *
 * The one load-bearing trick: `.device-screen` carries a `transform`, which
 * makes it the containing block for the app's `position: fixed` chrome (the
 * BottomNav pill and the SignInGate sheet). That is what pins them to the phone
 * instead of the browser window. The status bar is a real flex row that pushes
 * the app down; `.stage` becomes the scroll container inside the screen.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import PlayQR from "@/components/PlayQR";
import ThemeToggle from "@/components/ThemeToggle";

export default function DeviceFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  // Only an opened match sits inside the phone. The home page (and /results)
  // render full-width on the SAME desk (ambient + corner chrome), just without
  // the phone. Opening a match then transitions "into" the device.
  const framed = pathname?.startsWith("/match") ?? false;
  if (!framed) {
    // The home page (/) fits the viewport with no scroll; other full-width pages
    // (/results, /roadmap) can be long, so they get a scrollable desk instead.
    const isHome = pathname === "/";
    return (
      <div className={isHome ? "home-desk" : "page-desk"}>
        <div className="device-ambient" aria-hidden />
        <div className={isHome ? "home-stage" : "page-stage"}>
          <div className="stage-fx" aria-hidden>
            <span className="fx-blob fx-a" />
            <span className="fx-blob fx-b" />
            <span className="fx-blob fx-c" />
          </div>
          {children}
        </div>
        <DeskChrome />
      </div>
    );
  }
  return (
    <motion.div
      className="device-root"
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={reduce ? { duration: 0.25 } : { duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="device-ambient" aria-hidden />

      <div className="device-shell">
        <div className="device">
          <div className="device-buttons" aria-hidden>
            <span className="db-action" />
            <span className="db-volup" />
            <span className="db-voldn" />
            <span className="db-power" />
          </div>

          <div className="device-screen">
            <div className="device-statusbar" aria-hidden>
              <span className="sb-time">9:41</span>
              <span className="sb-glyphs">
                <SignalGlyph />
                <WifiGlyph />
                <BatteryGlyph />
              </span>
            </div>
            <div className="device-island" aria-hidden>
              <span className="di-lens" />
            </div>

            <div className="stage">
              <div className="stage-fx" aria-hidden>
                <span className="fx-blob fx-a" />
                <span className="fx-blob fx-b" />
                <span className="fx-blob fx-c" />
              </div>
              {children}
              {/* Inside .stage so it shares the app's stacking context and stays
                  under the BottomNav, rather than painting over it. */}
              <div className="device-home" aria-hidden />
            </div>
          </div>
        </div>
      </div>

      <DeskChrome />
      {/* Scan-to-play QR rides only with an open match and encodes this match's
          deep link, so a scan opens the same game on the player's phone. */}
      <PlayQR path={pathname ?? undefined} />
    </motion.div>
  );
}

/* The three desk-corner elements shared by the home desk and the match phone
   (roadmap, whitepaper, builder credit). The scan-to-play QR is NOT here: it is
   match-only and rendered separately so it can encode the specific game.
   Each is display:none below lg (see the "Device frame" block in globals.css). */
function DeskChrome() {
  return (
    <>
      <div className="device-top-left">
        <Link className="device-lobby" href="/">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M3 9.5 12 3l9 6.5" />
            <path d="M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10" />
            <path d="M9 21v-6h6v6" />
          </svg>
          Home
        </Link>
        <Link className="device-roadmap" href="/roadmap">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="6" cy="19" r="3" />
            <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
            <circle cx="18" cy="5" r="3" />
          </svg>
          Roadmap
        </Link>
      </div>

      <div className="device-top-right">
        <ThemeToggle className="!h-[38px] !w-[38px]" />
        <a
          className="device-paper"
          href="/ProofBall-Whitepaper.pdf"
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
            <path d="M16 13H8" />
            <path d="M16 17H8" />
            <path d="M10 9H8" />
          </svg>
          Whitepaper
        </a>
      </div>

      <a
        className="device-credit"
        href="https://x.com/0xS1dharth"
        target="_blank"
        rel="noopener noreferrer"
      >
        <img
          className="device-credit-dp"
          src="/sidharth.jpg"
          alt="Sidharth"
          width={40}
          height={40}
        />
        <span className="device-credit-text">
          <span className="dcr-by">Built by Sidharth</span>
          <span className="dcr-sub">Superteam Fellow · @0xS1dharth</span>
        </span>
      </a>
    </>
  );
}

/* ── iOS status-bar glyphs (currentColor = --ink, so theme-aware) ─────────── */

function SignalGlyph() {
  return (
    <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor" aria-hidden>
      <rect x="0" y="8" width="3" height="4" rx="1" />
      <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
      <rect x="10" y="3" width="3" height="9" rx="1" />
      <rect x="15" y="0.5" width="3" height="11.5" rx="1" />
    </svg>
  );
}

function WifiGlyph() {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor" aria-hidden>
      <path d="M8 2.2c2.6 0 5 1 6.8 2.7l1.2-1.3A11.4 11.4 0 0 0 8 .3 11.4 11.4 0 0 0 0 3.6l1.2 1.3A9.6 9.6 0 0 1 8 2.2Z" />
      <path d="M8 5.6c1.7 0 3.3.7 4.5 1.8l1.2-1.3A8 8 0 0 0 8 3.7a8 8 0 0 0-5.7 2.4l1.2 1.3A6.3 6.3 0 0 1 8 5.6Z" />
      <path d="M8 9c.9 0 1.7.4 2.3 1L8 12.4 5.7 10A3.2 3.2 0 0 1 8 9Z" />
    </svg>
  );
}

function BatteryGlyph() {
  return (
    <svg width="26" height="13" viewBox="0 0 26 13" fill="none" aria-hidden>
      <rect x="0.5" y="0.5" width="22" height="12" rx="3.5" stroke="currentColor" strokeOpacity="0.4" />
      <rect x="2" y="2" width="17" height="9" rx="2" fill="currentColor" />
      <path d="M24 4v5a2 2 0 0 0 0-5Z" fill="currentColor" fillOpacity="0.4" />
    </svg>
  );
}
