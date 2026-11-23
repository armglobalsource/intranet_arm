import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Paleta de armglobal.org: carbón, crema y grises cálidos, con acento terracota.
        // «emerald» se redefine porque era el color de marca de la intranet: así todas sus clases
        // toman la identidad ARM sin tocar cada pantalla.
        emerald: {
          50: '#fff9f4', 100: '#f6eee6', 200: '#e9ded3', 300: '#d3c5b8', 400: '#a99c90',
          500: '#8a7e73', 600: '#5e5750', 700: '#31302e', 800: '#262523', 900: '#1d1d1b', 950: '#141413',
        },
        arm: {
          ink: '#1d1d1b', charcoal: '#31302e', gray: '#656260', stone: '#8f8f8f', line: '#e4ddd5',
          cream: '#fff9f4', sand: '#f6f1ec', terracotta: '#e17b5f', clay: '#96523f', blush: '#ebb6a7', forest: '#2c5e4d',
        },
        brand: {
          50:  '#f5f5f5',
          100: '#e8e8e8',
          500: '#3a3a3a',
          600: '#1a1a1a',
          700: '#0d0d0d',
          900: '#000000',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
