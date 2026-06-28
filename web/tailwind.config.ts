import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/design-system/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.stories.@(js,jsx,mjs,ts,tsx)",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--color-bg)",
        foreground: "var(--color-text)",
        surface: "var(--color-surface)",
        "surface-alt": "var(--color-surface-alt)",
        "surface-muted": "var(--color-surface-muted)",
        border: "var(--color-border)",
        muted: "var(--color-text-muted)",
        primary: {
          50: "var(--color-primary-50)",
          100: "var(--color-primary-100)",
          300: "var(--color-primary-300)",
          500: "var(--color-primary-500)",
          600: "var(--color-primary-600)",
          700: "var(--color-primary-700)",
          900: "var(--color-primary-900)",
          DEFAULT: "var(--color-primary)",
          hover: "var(--color-primary-hover)",
        },
        income: "var(--color-income)",
        expense: "var(--color-expense)",
        saving: "var(--color-saving)",
        project: "var(--color-project)",
        warning: "var(--color-warning)",
        ai: "var(--color-ai)",
        other: "var(--color-other)",
      },
      boxShadow: {
        soft: "0 18px 55px -36px var(--shadow-soft-color)",
        card: "0 20px 45px -32px var(--shadow-card-color)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)"],
        mono: ["var(--font-geist-mono)"],
      },
    },
  },
  plugins: [],
};
export default config;
