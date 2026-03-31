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
        'bg-base': '#0a0a0a',
        'bg-surface': '#111111',
        'bg-elevated': '#1a1a1a',
        'bg-hover': '#222222',
        'accent-primary': '#facc15',
        'accent-secondary': '#fb923c',
        'accent-success': '#22c55e',
        'accent-danger': '#ef4444',
        'accent-warning': '#eab308',
        'text-primary': '#e4e4e7',
        'text-secondary': '#a1a1aa',
        'text-muted': '#52525b',
        'border-default': '#1c1c1c',
        'border-active': '#facc15',
      },
    },
  },
  plugins: [],
};

export default config;
