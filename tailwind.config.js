/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F5F2EA',
        surface: '#FFFFFF',
        sunken: '#EFEBE1',
        line: '#E5E2D9',
        ink: '#202722',
        muted: '#5F665F',
        faint: '#646A64',
        primary: { DEFAULT: '#194A3D', hover: '#123A30', soft: '#E3ECE7' },
        sidebar: { DEFAULT: '#10241F', line: '#1E3A33', text: '#A9B8B1' },
        danger: { DEFAULT: '#B5372E', soft: '#FBEAE8' },
        warn: { DEFAULT: '#8F5D0C', soft: '#FBF1DD' },
        info: { DEFAULT: '#2F5E9E', soft: '#E7EEF8' },
        ok: { DEFAULT: '#276B43', soft: '#E4F2E9' },
      },
      fontFamily: {
        display: ['"Instrument Serif"', '"Instrument Serif Fallback"', 'Georgia', 'serif'],
        sans: ['Geist', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(32, 39, 34, 0.04), 0 0 0 1px rgba(32, 39, 34, 0.02)',
        pop: '0 12px 40px -8px rgba(16, 36, 31, 0.25)',
      },
    },
  },
  plugins: [],
};
