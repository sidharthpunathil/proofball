"use client";

import { m, useReducedMotion, type Variants } from "framer-motion";
import { EASE_OUT, springPop } from "@/lib/motion";

/**
 * WinProbDemo, the hero explainer chart on /how-it-works.
 *
 * It tells the game's story as a sequence, triggered once when scrolled into
 * view: (1) the field appears, (2) your call window and "Rising" pick pop in,
 * (3) the win-probability line draws across the match, (4) the goal pops the
 * moment the line reaches it, (5) the closing % tag lands. Explainer-tier
 * timing on purpose: this page is seen once, so it gets the delight budget.
 * Bespoke SVG (not a chart lib) to match ProbabilityChart / Sparkline.
 */

// A hand-crafted "chance to win" series: minute → %. A visible rise inside the
// call window, then a goal spike, then it holds high. Illustrative numbers,
// honest shape.
const SERIES: [min: number, prob: number][] = [
  [0, 49], [5, 50], [10, 51], [14, 55], [18, 60], [22, 58], [27, 56],
  [31, 55], [34, 56], [35, 74], [42, 72], [50, 73], [58, 71], [66, 72],
  [74, 71], [82, 73], [90, 74],
];

const GOAL_MIN = 35;
const GOAL_PROB = 74;
// The illustrated call: locked at 10', resolved at 18'.
const CALL_FROM = 10;
const CALL_TO = 18;

// Geometry (SVG user units).
const W = 320;
const H = 158;
const PT = 24;
const PB = 20;
const PL = 6;
const PR = 40;
const DMIN = 42;
const DMAX = 82;

const x = (min: number) => PL + (min / 90) * (W - PL - PR);
const y = (prob: number) => PT + (1 - (prob - DMIN) / (DMAX - DMIN)) * (H - PT - PB);

const pts = SERIES.map(([mn, p]) => [x(mn), y(p)] as const);
const linePts = pts.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
const areaPts = `${x(0)},${H - PB} ${linePts} ${x(90)},${H - PB}`;
const endProb = SERIES[SERIES.length - 1][1];

// Where the goal sits along the polyline's LENGTH (not its x). The draw uses a
// linear pathLength tween, so delay = DRAW_START + fraction * DRAW_DUR makes
// the goal pop exactly as the line arrives at it.
const goalFraction = (() => {
  let total = 0;
  let atGoal = 0;
  for (let i = 1; i < pts.length; i++) {
    total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (SERIES[i][0] === GOAL_MIN) atGoal = total;
  }
  return atGoal / total;
})();

// The beat sheet.
const T_FIELD = 0;
const T_CALL = 0.2;
const DRAW_START = 0.75;
const DRAW_DUR = 1.4;
const T_GOAL = DRAW_START + goalFraction * DRAW_DUR;
const T_END = DRAW_START + DRAW_DUR;
const T_CAPTION = T_END + 0.15;

const fadeAt = (t: number): Variants => ({
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { delay: t, duration: 0.35, ease: EASE_OUT } },
});
const popAt = (t: number): Variants => ({
  hidden: { opacity: 0, scale: 0.5 },
  show: { opacity: 1, scale: 1, transition: { delay: t, ...springPop } },
});

// Chip: a rounded label rendered natively in SVG.
function Chip({
  cx,
  cy,
  text,
  tone,
  variants,
}: {
  cx: number;
  cy: number;
  text: string;
  tone: "grn" | "amber";
  variants?: Variants;
}) {
  const w = text.length * 5.4 + 14;
  const fill = tone === "grn" ? "fill-grnsoft" : "fill-amber/15";
  const stroke = tone === "grn" ? "stroke-grn/40" : "stroke-amber/40";
  // Positioning lives on a plain outer <g>: framer writes CSS transforms, which
  // would override an SVG transform attribute on the same node and teleport the
  // chip to the origin. The inner m.g only ever scales around its own box.
  return (
    <g transform={`translate(${cx - w / 2}, ${cy})`}>
      <m.g variants={variants} style={{ transformBox: "fill-box", transformOrigin: "center" }}>
        <rect x={0} y={-9} width={w} height={18} rx={9} className={`${fill} ${stroke}`} strokeWidth={1} />
        <text x={w / 2} y={3.5} textAnchor="middle" className="fill-ink" style={{ fontSize: 10, fontWeight: 800 }}>
          {text}
        </text>
      </m.g>
    </g>
  );
}

export default function WinProbDemo() {
  const reduce = useReducedMotion();

  return (
    <m.div
      className="w-full select-none"
      initial={reduce ? false : "hidden"}
      whileInView={reduce ? undefined : "show"}
      viewport={{ once: true, margin: "-60px" }}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="A team's chance to win moving through a match, with a goal and your Rising call">
        {/* Beat 1 · the field: 50% line + axis. */}
        <m.g variants={fadeAt(T_FIELD)}>
          <line x1={PL} x2={W - PR} y1={y(50)} y2={y(50)} className="stroke-line2" strokeWidth={1} strokeDasharray="1 4" strokeLinecap="round" />
          <text x={W - PR - 4} y={y(50) - 5} textAnchor="end" className="fill-faint" style={{ fontSize: 8.5, fontWeight: 600 }}>
            50% · coin flip
          </text>
          <text x={PL} y={H - 6} className="fill-faint tabular-nums" style={{ fontSize: 9, fontWeight: 600 }}>
            0’
          </text>
          <text x={x(90)} y={H - 6} textAnchor="end" className="fill-faint tabular-nums" style={{ fontSize: 9, fontWeight: 600 }}>
            90’
          </text>
        </m.g>

        {/* Beat 2 · your call: the window band + the Rising chip. */}
        <m.g variants={fadeAt(T_CALL)}>
          <rect
            x={x(CALL_FROM)}
            y={PT}
            width={x(CALL_TO) - x(CALL_FROM)}
            height={H - PT - PB}
            rx={8}
            className="fill-grn/10"
          />
          <line x1={x(CALL_FROM)} x2={x(CALL_FROM)} y1={PT + 4} y2={H - PB} className="stroke-grn/40" strokeWidth={1} strokeDasharray="2 3" />
          <line x1={x(CALL_TO)} x2={x(CALL_TO)} y1={PT + 4} y2={H - PB} className="stroke-grn/40" strokeWidth={1} strokeDasharray="2 3" />
        </m.g>
        <Chip cx={x((CALL_FROM + CALL_TO) / 2)} cy={68} text="▲ Rising ✓" tone="grn" variants={popAt(T_CALL + 0.15)} />

        {/* Beat 3 · the match plays: area + line draw left to right. */}
        <m.polygon
          points={areaPts}
          className="fill-grn"
          variants={{
            hidden: { opacity: 0 },
            show: { opacity: 0.1, transition: { delay: DRAW_START + 0.3, duration: DRAW_DUR - 0.3, ease: "linear" } },
          }}
        />
        <m.polyline
          points={linePts}
          fill="none"
          className="stroke-grn"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          variants={{
            hidden: { pathLength: 0, opacity: 0 },
            show: {
              pathLength: 1,
              opacity: 1,
              transition: {
                pathLength: { delay: DRAW_START, duration: DRAW_DUR, ease: "linear" },
                opacity: { delay: DRAW_START, duration: 0.01 },
              },
            },
          }}
        />

        {/* Beat 4 · the goal: pops the moment the line reaches 35'. */}
        <m.g variants={fadeAt(T_GOAL)}>
          <line x1={x(GOAL_MIN)} x2={x(GOAL_MIN)} y1={PT + 4} y2={H - PB} className="stroke-amber/50" strokeWidth={1} strokeDasharray="2 3" />
        </m.g>
        <m.circle
          cx={x(GOAL_MIN)}
          cy={y(GOAL_PROB)}
          r={3.2}
          className="fill-amber"
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
          variants={popAt(T_GOAL)}
        />
        <Chip cx={x(GOAL_MIN)} cy={PT - 12} text="Goal · 35'" tone="amber" variants={popAt(T_GOAL + 0.05)} />

        {/* Beat 5 · where it ends: live dot + % tag. */}
        <m.g variants={popAt(T_END)} style={{ transformBox: "fill-box", transformOrigin: "center" }}>
          <circle cx={x(90)} cy={y(endProb)} r={3} className="fill-grn" />
          <g transform={`translate(${W - PR + 4}, ${y(endProb)})`}>
            <rect x={0} y={-9} width={PR - 8} height={18} rx={5} className="fill-grnsoft" />
            <text x={(PR - 8) / 2} y={3.6} textAnchor="middle" className="fill-ink tabular-nums" style={{ fontSize: 10.5, fontWeight: 800 }}>
              {endProb}%
            </text>
          </g>
        </m.g>
      </svg>

      <m.p variants={fadeAt(T_CAPTION)} className="mt-1 px-1 text-center text-[12px] leading-[1.5] text-ink2">
        You tapped <span className="font-semibold text-grn">Rising</span> at 10 minutes. The chance climbed, so
        you won. And see the goal at 35: one big moment sends it flying.
      </m.p>
    </m.div>
  );
}
