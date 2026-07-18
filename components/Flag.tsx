import { flagCode } from "@/lib/flags";

/**
 * A small country-flag chip , the replacement for the old coloured team dot.
 *
 * Renders the flag as a crisp rounded rectangle from flagcdn (SVG, so it stays
 * sharp at any size and looks identical on every OS, unlike emoji flags which
 * degrade to two letters on Windows). `color` is the team's dot colour, used as
 * a backing fill so a blocked or still-loading flag shows a team-tinted chip
 * instead of a broken image , and as the whole shape for any nation we have no
 * flag code for. `size` is the chip height in px; width follows a uniform 4:3.
 */
export default function Flag({
  abbr,
  color,
  size = 12,
  className = "",
}: {
  abbr: string;
  color?: string;
  size?: number;
  className?: string;
}) {
  const code = flagCode(abbr);

  if (!code) {
    return (
      <span
        aria-hidden
        className={`shrink-0 rounded-full ${className}`}
        style={{ width: size, height: size, background: color ?? "rgb(var(--mut))" }}
      />
    );
  }

  const w = Math.round((size * 4) / 3);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/${code}.svg`}
      alt=""
      aria-hidden
      width={w}
      height={size}
      loading="lazy"
      decoding="async"
      className={`shrink-0 rounded-[3px] border border-line object-cover ${className}`}
      style={{ width: w, height: size, background: color }}
    />
  );
}
