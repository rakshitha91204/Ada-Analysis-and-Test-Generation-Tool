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
        'bg-base': '#1e1e2e',
        'bg-surface': '#181825',
        'bg-elevated': '#24243a',
        'bg-hover': '#2a2a3e',
        'accent-primary': '#cba6f7',
        'accent-secondary': '#c586c0',
        'accent-success': '#a6e3a1',
        'accent-danger': '#f38ba8',
        'accent-warning': '#fab387',
        'text-primary': '#cdd6f4',
        'text-secondary': '#bac2de',
        'text-muted': '#6c7086',
        'border-default': '#313244',
        'border-active': '#cba6f7',
      },
    },
  },
  plugins: [],
};

export default config;
