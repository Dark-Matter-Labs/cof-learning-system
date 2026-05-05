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
        'node-hunch':         '#085A8C',
        'node-assumption-bg': '#1D9E75',
        'node-assumption-fg': '#F27F3D',
        'node-test':          '#D4537E',
        'node-learning':      '#3786A6',
        'node-option':        '#192640',
        'node-entity':        '#8C8980',
        'node-site':          '#639922',
        'node-commitment':    '#085A8C',
      },
      fontFamily: {
        sans:    ['var(--font-inter)', 'system-ui', 'sans-serif'],
        body:    ['var(--font-crimson-pro)', 'Georgia', 'serif'],
        display: ['var(--font-crimson-pro)', 'Georgia', 'serif'],
        ui:      ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono:    ['var(--font-dm-mono)', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
};
export default config;
