/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        strava: {
          orange: '#FC4C02',
          'orange-dark': '#E34402',
          blue: '#2D6CDF',
          dark: '#1A1A1A',
          gray: '#707070',
          'gray-light': '#F5F5F5'
        }
      }
    },
  },
  plugins: [],
}

