import type { Config } from "tailwindcss";

// Colours resolve to the CSS tokens in app/globals.css, so there is one source.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--kb-cream)",
        surface: "var(--kb-white)",
        sand: "var(--kb-sand)",
        line: "var(--kb-line)",
        ink: {
          DEFAULT: "var(--color-text)",
          70: "var(--ink-70)",
          55: "var(--ink-55)",
          35: "var(--ink-35)",
        },
        divider: "var(--kb-line)",
        neutral: {
          100: "var(--color-neutral-100)",
          200: "var(--color-neutral-200)",
          300: "var(--color-neutral-300)",
          400: "var(--color-neutral-400)",
          500: "var(--color-neutral-500)",
          600: "var(--color-neutral-600)",
          700: "var(--color-neutral-700)",
          800: "var(--color-neutral-800)",
          900: "var(--color-neutral-900)",
        },
        accent: {
          DEFAULT: "var(--color-accent)",
          100: "var(--color-accent-100)",
          200: "var(--color-accent-200)",
          300: "var(--color-accent-300)",
          400: "var(--color-accent-400)",
          500: "var(--color-accent-500)",
          600: "var(--color-accent-600)",
          700: "var(--color-accent-700)",
          800: "var(--color-accent-800)",
          900: "var(--color-accent-900)",
        },
        "accent-2": {
          DEFAULT: "var(--color-accent-2)",
          100: "var(--color-accent-2-100)",
          800: "var(--color-accent-2-800)",
        },
      },
      fontFamily: {
        heading: ["var(--font-fredoka)", "system-ui", "sans-serif"],
        body: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "0px",
        md: "0px",
        lg: "0px",
      },
      boxShadow: {
        sm: "0 1px 2px rgb(43 34 40 / 0.06)",
        md: "0 4px 12px rgb(43 34 40 / 0.1)",
        lg: "var(--shadow-lg)",
      },
      fontSize: {
        h1: ["42px", { lineHeight: "1.12", letterSpacing: "-0.015em" }],
        h2: ["32px", { lineHeight: "1.12", letterSpacing: "-0.015em" }],
        h3: ["25px", { lineHeight: "1.12", letterSpacing: "-0.015em" }],
        h4: ["20px", { lineHeight: "1.12", letterSpacing: "-0.015em" }],
      },
    },
  },
};

export default config;
