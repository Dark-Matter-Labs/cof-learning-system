import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'node-hunch': '#7F77DD',
        'node-assumption-bg': '#1D9E75',
        'node-assumption-fg': '#D85A30',
        'node-test': '#D4537E',
        'node-learning': '#378ADD',
        'node-option': '#BA7517',
        'node-entity': '#888780',
        'node-site': '#639922',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
export default config;
