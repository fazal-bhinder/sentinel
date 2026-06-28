import type { Config } from "tailwindcss";

// Signal Room palette: an ink-navy console, not pure black. Teal = a signal
// that's alive, amber = warn, coral = a field gone dark.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0B1220",
        panel: "#0E1626",
        raised: "#111E33",
        line: "#1E2B43",
        line2: "#2A3A57",
        text: "#E6EDF7",
        muted: "#8194B0",
        faint: "#56688A",
        alive: "#2DD4BF",
        warn: "#F5B544",
        dark: "#FF5C49",
        oa: "#2DD4BF",
        an: "#8B7CF0",
        cu: "#5EA8FF",
      },
      fontFamily: {
        sans: ["var(--font-archivo)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
