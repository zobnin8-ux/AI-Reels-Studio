import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        panel: "rgb(16 18 22)",
        panel2: "rgb(20 22 27)",
        border: "rgb(38 41 48)",
        text: "rgb(236 238 242)",
        muted: "rgb(159 167 180)",
        accent: "rgb(126 231 255)",
        accent2: "rgb(180 140 255)"
      },
      boxShadow: {
        soft: "0 8px 30px rgba(0,0,0,0.45)"
      }
    }
  },
  plugins: []
} satisfies Config;

