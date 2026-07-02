/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        panel: {
          bg: '#0f1115',
          surface: '#161922',
          surface2: '#1e2230',
          border: '#2a2f3d',
          accent: '#4ade80',
          accent2: '#22c55e',
          danger: '#f87171',
          warn: '#fbbf24',
          text: '#e5e7eb',
          muted: '#9ca3af',
        },
      },
    },
  },
  plugins: [],
};
