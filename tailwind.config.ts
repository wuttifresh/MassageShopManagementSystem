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
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: "#FFFFFF",
        border: "#E5E7EB",
        "text-secondary": "#6B7280",
        primary: {
          DEFAULT: "#2563EB",
          hover: "#1D4ED8",
          light: "#EFF6FF",
        },
        secondary: {
          DEFAULT: "#3B82F6",
          hover: "#2563EB",
        },
        accent: {
          DEFAULT: "#14B8A6",
          hover: "#0D9488",
          light: "#F0FDFA",
        },
        success: {
          DEFAULT: "#22C55E",
          hover: "#16A34A",
          light: "#F0FDF4",
        },
        warning: {
          DEFAULT: "#F59E0B",
          hover: "#D97706",
          light: "#FFFBEB",
        },
        danger: {
          DEFAULT: "#EF4444",
          hover: "#DC2626",
          light: "#FEF2F2",
        },
      },
      fontFamily: {
        sans: ["var(--font-sarabun)", "var(--font-noto-sans-thai)", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px 0 rgba(17, 24, 39, 0.05)",
        card: "0 1px 3px 0 rgba(17, 24, 39, 0.08), 0 1px 2px -1px rgba(17, 24, 39, 0.06)",
        "card-hover": "0 4px 12px -2px rgba(17, 24, 39, 0.1), 0 2px 4px -2px rgba(17, 24, 39, 0.06)",
        dropdown: "0 10px 20px -5px rgba(17, 24, 39, 0.12), 0 4px 6px -4px rgba(17, 24, 39, 0.08)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(16px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "drawer-in": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.6s infinite linear",
        "fade-in": "fade-in 0.15s ease-out",
        "slide-up": "slide-up 0.2s ease-out",
        "slide-in-right": "slide-in-right 0.2s ease-out",
        "drawer-in": "drawer-in 0.2s ease-out",
      },
    },
  },
  plugins: [],
};
export default config;
