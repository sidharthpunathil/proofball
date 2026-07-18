import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Trophy } from "@/components/Icons";

export const metadata: Metadata = {
  title: "Page not found",
  description: "This page went wide of the post.",
};

// The same 240-degree arc the win-probability gauge draws, parked at zero:
// the market's verdict on this URL. Pure SVG so the 404 stays server-rendered.
function ZeroGauge() {
  const size = 220;
  const R = size * 0.42;
  const cx = size / 2;
  const cy = size / 2 + size * 0.06;
  const startA = (210 * Math.PI) / 180;
  const endA = (-30 * Math.PI) / 180;
  const arc = (from: number, to: number) => {
    const x1 = cx + R * Math.cos(from);
    const y1 = cy - R * Math.sin(from);
    const x2 = cx + R * Math.cos(to);
    const y2 = cy - R * Math.sin(to);
    const large = Math.abs(to - from) > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`;
  };
  // The needle knob parked at the very start of the track: zero percent.
  const knobX = cx + R * Math.cos(startA);
  const knobY = cy - R * Math.sin(startA);
  return (
    <div className="relative" style={{ width: size, height: size * 0.82 }}>
      <svg width={size} height={size * 0.82} aria-hidden>
        <path d={arc(startA, endA)} className="stroke-line2" strokeWidth={10} fill="none" strokeLinecap="round" />
        <circle cx={knobX} cy={knobY} r={6} className="fill-bg stroke-grn" strokeWidth={3.5} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-6">
        <div className="text-[44px] font-extrabold tracking-[-0.03em] text-ink">
          0<span className="text-[20px] font-bold text-ink2">%</span>
        </div>
        <div className="text-[10px] font-bold tracking-[0.18em] text-ink2 opacity-60">PAGE FOUND</div>
      </div>
    </div>
  );
}

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-6 pb-16 pt-8 text-center">
      <ZeroGauge />
      <h1 className="mt-6 text-[32px] font-extrabold leading-[1.1] tracking-[-0.02em] text-ink">
        Off the pitch.
      </h1>
      <p className="mt-3 max-w-xs text-[14.5px] leading-[1.55] text-ink2">
        This page went wide of the post. The market gives it a 0% chance of existing, and every result here is
        verified, so we would know.
      </p>
      <div className="mt-8 flex w-full max-w-xs flex-col gap-2.5">
        <Link
          href="/"
          className="flex items-center justify-center gap-2 rounded-2xl bg-ink py-3.5 text-[15px] font-semibold text-bg transition-transform active:scale-[0.985]"
        >
          <ChevronLeft size={18} />
          Back to the lobby
        </Link>
        <Link
          href="/results"
          className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-surface py-3.5 text-[15px] font-semibold text-ink transition-transform active:scale-[0.985]"
        >
          <Trophy size={17} />
          Browse verified results
        </Link>
      </div>
    </main>
  );
}
