import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        panel: "rgb(18 24 33)",
        panel2: "rgb(12 17 24)",
        border: "rgb(43 54 71)",
        text: "rgb(232 238 247)",
        muted: "rgb(141 156 178)",
        accent: "rgb(110 231 255)",
        accent2: "rgb(155 140 255)"
      },
      boxShadow: {
        soft: "0 8px 30px rgba(0,0,0,0.45)"
      }
    }
  },
  plugins: []
} satisfies Config;

