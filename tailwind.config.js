/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./src/popup/**/*.{js,jsx,ts,tsx}",
    "./src/options/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1a73e8',
          dark: '#1967d2',
          light: '#4285f4'
        },
        warning: {
          DEFAULT: '#fbbc04',
          dark: '#f9ab00',
          light: '#fef7f0'
        }
      }
    },
  },
  plugins: [],
}