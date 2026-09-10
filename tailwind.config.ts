import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        otto: {
          bg: "rgb(var(--otto-bg) / <alpha-value>)",
          surface: "rgb(var(--otto-surface) / <alpha-value>)",
          "surface-raise": "rgb(var(--otto-surface-raise) / <alpha-value>)",
          divider: "rgb(var(--otto-divider) / <alpha-value>)",
          text: "rgb(var(--otto-text) / <alpha-value>)",
          "text-dim": "rgb(var(--otto-text-dim) / <alpha-value>)",
          "text-faint": "rgb(var(--otto-text-faint) / <alpha-value>)",
          green: "rgb(var(--otto-green) / <alpha-value>)",
          "green-soft": "rgb(var(--otto-green-soft) / <alpha-value>)",
          red: "rgb(var(--otto-red) / <alpha-value>)",
          "red-soft": "rgb(var(--otto-red-soft) / <alpha-value>)",
          amber: "rgb(var(--otto-amber) / <alpha-value>)",
          "amber-soft": "rgb(var(--otto-amber-soft) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      screens: {
        desk: "860px",
      },
    },
  },
  plugins: [],
};

export default config;
