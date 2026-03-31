import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        sans: ['"IBM Plex Sans"', 'sans-serif'],
      },
      colors: {
        'bg-base': '#0e0e10',
        'bg-surface': '#16161a',
        'bg-elevated': '#1e1e24',
        'bg-hover': '#252530',
        'accent-primary': '#f59e0b',
        'accent-secondary': '#fb923c',
        'accent-success': '#22c55e',
        'accent-danger': '#ef4444',
        'accent-warning': '#eab308',
        'text-primary': '#f4f4f5',
        'text-secondary': '#a1a1aa',
        'text-muted': '#52525b',
        'border-default': '#27272a',
        'border-active': '#f59e0b',
      },
    },
  },
  plugins: [],
};

export default config;
