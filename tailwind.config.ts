import type { Config } from "tailwindcss";

// Colors are CSS variables (RGB channel triplets) so a single [data-theme]
// switch flips the whole UI between light and dark. See globals.css.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: v("bg"),
        surface: v("surface"),
        subtle: v("subtle"),
        ink: v("ink"),
        ink2: v("ink2"),
        mut: v("mut"),
        faint: v("faint"),
        line: v("line"),
        line2: v("line2"),
        grn: v("grn"),
        grnsoft: v("grnsoft"),
        red: v("red"),
        redsoft: v("redsoft"),
        blue: v("blue"),
        amber: v("amber"),
        orange: v("orange"),
        violet: v("violet"),
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "SF Pro Text",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "var(--shadow-card)",
        soft: "var(--shadow-soft)",
        btn: "var(--shadow-btn)",
      },
      keyframes: {
        pulse2: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.4", transform: "scale(0.82)" },
        },
        // Generic entrance: opacity + a small rise. Matches listItem (y: 8) in
        // lib/motion.ts so CSS- and JS-driven entrances agree.
        slideup: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        popin: {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        // Settlement entrances. popwin lands with a celebratory overshoot
        // (ease-back); poplose settles calmly with no bounce, out of respect
        // for the outcome. Both scale from 0.9, never 0.
        popwin: {
          "0%": { opacity: "0", transform: "scale(0.9) translateY(6px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        poplose: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        // Win-prob panel flash. flash = up move (green), flashDown = down move
        // (red). Selected by direction in ProbabilityNeedle so colour agrees
        // with the number and arrow.
        flash: {
          "0%": { backgroundColor: "rgb(var(--grn) / 0.16)" },
          "100%": { backgroundColor: "rgb(var(--grn) / 0)" },
        },
        flashDown: {
          "0%": { backgroundColor: "rgb(var(--red) / 0.16)" },
          "100%": { backgroundColor: "rgb(var(--red) / 0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        pulse2: "pulse2 1.4s ease-in-out infinite",
        slideup: "slideup 0.28s var(--ease-out)",
        popin: "popin 0.28s var(--ease-out)",
        popwin: "popwin 0.28s var(--ease-back)",
        poplose: "poplose 0.28s var(--ease-out)",
        flash: "flash 0.6s ease-out",
        flashDown: "flashDown 0.6s ease-out",
        shimmer: "shimmer 2.4s linear infinite",
      },
      transitionTimingFunction: {
        "out-expo": "var(--ease-out)",
        "back": "var(--ease-back)",
      },
    },
  },
  plugins: [],
};

export default config;
