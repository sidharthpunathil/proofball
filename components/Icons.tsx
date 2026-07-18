import type { LucideIcon, LucideProps } from "lucide-react";
import {
  Activity as LrActivity,
  ArrowDown as LrArrowDown,
  ArrowDownRight as LrArrowDownRight,
  ArrowRight as LrArrowRight,
  ArrowUp as LrArrowUp,
  ArrowUpRight as LrArrowUpRight,
  Calendar as LrCalendar,
  CandlestickChart as LrCandlestickChart,
  Check as LrCheck,
  ChevronDown as LrChevronDown,
  ChevronLeft as LrChevronLeft,
  ChevronRight as LrChevronRight,
  Clock as LrClock,
  Coins as LrCoins,
  ExternalLink as LrExternalLink,
  Flame as LrFlame,
  Gauge as LrGauge,
  Gift as LrGift,
  Info as LrInfo,
  LayoutGrid as LrLayoutGrid,
  Link2 as LrLink2,
  Lock as LrLock,
  Maximize2 as LrMaximize2,
  Moon as LrMoon,
  MoreHorizontal as LrMoreHorizontal,
  Play as LrPlay,
  Plus as LrPlus,
  Radio as LrRadio,
  Settings as LrSettings,
  Share2 as LrShare2,
  ShieldCheck as LrShieldCheck,
  Sun as LrSun,
  Target as LrTarget,
  Trophy as LrTrophy,
  User as LrUser,
  X as LrX,
} from "lucide-react";

// Public prop shape kept identical to the previous hand-rolled icons:
// { size?: number; strokeWidth?: number; className?: string } plus any SVG props.
type IconProps = LucideProps;

// Thin shim: wrap a lucide icon so `size` defaults to 20 (lucide defaults to 24)
// and `aria-hidden` is on by default. `className` (e.g. "text-grn") passes through,
// and lucide strokes with `currentColor`, so text-color utilities still tint them.
function icon(Icon: LucideIcon, name: string) {
  function Wrapped({ size, ...rest }: IconProps) {
    return <Icon size={size ?? 20} aria-hidden {...rest} />;
  }
  Wrapped.displayName = name;
  return Wrapped;
}

// Brand icon: lucide has no soccer ball, so keep a tasteful custom football.
export const Ball = ({ size, strokeWidth, className, ...rest }: IconProps) => (
  <svg
    width={size ?? 20}
    height={size ?? 20}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth ?? 2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
    {...rest}
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.2l4.2 3-1.6 4.9H9.4L7.8 10.2z" />
    <path d="M12 7.2V3.2M16.2 10.2l3.6-1.3M14.6 15.1l2.3 3.1M9.4 15.1l-2.3 3.1M7.8 10.2L4.2 8.9" />
  </svg>
);
Ball.displayName = "Ball";

// Bullseye: bolder than lucide's Target, with a SOLID centre dot so the
// multiplier tile reads as an on-target hit, not just nested rings.
export const Bullseye = ({ size, strokeWidth, className, ...rest }: IconProps) => (
  <svg
    width={size ?? 20}
    height={size ?? 20}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth ?? 2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
    {...rest}
  >
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none" />
  </svg>
);
Bullseye.displayName = "Bullseye";

export const Target = icon(LrTarget, "Target");
export const ShieldCheck = icon(LrShieldCheck, "ShieldCheck");
export const Flame = icon(LrFlame, "Flame");
export const Coin = icon(LrCoins, "Coin");
export const Check = icon(LrCheck, "Check");
export const Close = icon(LrX, "Close");
export const ArrowRight = icon(LrArrowRight, "ArrowRight");
export const ArrowUp = icon(LrArrowUp, "ArrowUp");
export const ArrowDown = icon(LrArrowDown, "ArrowDown");
export const Share = icon(LrShare2, "Share");
export const ExternalLink = icon(LrExternalLink, "ExternalLink");
export const Trophy = icon(LrTrophy, "Trophy");
export const Broadcast = icon(LrRadio, "Broadcast");
export const Play = icon(LrPlay, "Play");
export const Lock = icon(LrLock, "Lock");
export const Expand = icon(LrMaximize2, "Expand");
export const Link = icon(LrLink2, "Link");
export const Sun = icon(LrSun, "Sun");
export const Moon = icon(LrMoon, "Moon");
export const ArrowUpRight = icon(LrArrowUpRight, "ArrowUpRight");
export const ArrowDownRight = icon(LrArrowDownRight, "ArrowDownRight");
export const ChevronDown = icon(LrChevronDown, "ChevronDown");
export const ChevronLeft = icon(LrChevronLeft, "ChevronLeft");
export const ChevronRight = icon(LrChevronRight, "ChevronRight");
export const Clock = icon(LrClock, "Clock");
export const Calendar = icon(LrCalendar, "Calendar");
export const Plus = icon(LrPlus, "Plus");
export const User = icon(LrUser, "User");
export const Grid = icon(LrLayoutGrid, "Grid");
export const Gift = icon(LrGift, "Gift");
export const Activity = icon(LrActivity, "Activity");
export const Gauge = icon(LrGauge, "Gauge");
export const CandlestickChart = icon(LrCandlestickChart, "CandlestickChart");
export const Settings = icon(LrSettings, "Settings");
export const Info = icon(LrInfo, "Info");
export const Dots = icon(LrMoreHorizontal, "Dots");
