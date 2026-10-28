/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          50: '#fbf8f2',
          100: '#f5edd9',
          200: '#edd8b0',
          300: '#dfbc7d',
          400: '#d29f4f',
          500: '#c58a38',
          600: '#a76f2d',
          700: '#865427',
          800: '#6c4324',
          900: '#58371f',
        },
        sand: {
          50: '#fcfbf9',
          100: '#f8f5ee',
          200: '#f1ebd9',
          300: '#e6dcbe',
          400: '#d7c79e',
          500: '#c5b180',
          600: '#b09968',
          700: '#8e7952',
          800: '#736244',
          900: '#5e5039',
        },
        luxury: {
          black: '#090a0c',
          card: '#12141a',
          cardBorder: '#232733',
          muted: '#848d9f',
        }
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
