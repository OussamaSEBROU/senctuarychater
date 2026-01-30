/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
    "./*.{js,ts,jsx,tsx}",
    // Exclude node_modules explicitly
    "!./node_modules/**"
  ],
  theme: {
    extend: {
      colors: {
        'accent-orange': '#a34a28',
      },
      fontFamily: {
        sans: ['Montserrat', 'sans-serif'],
        academic: ['Crimson Pro', 'Montserrat Arabic', 'serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
      },
    },
  },
  plugins: [],
}
