/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#F1F7F3",
          100: "#DCECE2",
          200: "#B7D6C3",
          400: "#4F8F6C",
          500: "#2F6B4F",
          600: "#245A41",
          700: "#1B4633",
          800: "#143528",
          900: "#0C1F17",
        },
        ink: "#121816",
        mute: "#5A665F",
        line: "#D6DDD8",
        paper: "#F6F7F5",
        charcoal: "#101513",
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', "Helvetica", "Arial", "sans-serif"],
        display: ['"IBM Plex Serif"', '"IBM Plex Sans"', "Helvetica", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
