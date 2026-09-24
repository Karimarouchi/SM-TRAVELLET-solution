/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./*.html", "./*/*.html", "./frontend/**/*.html", "./frontend/**/*.js", "./js/**/*.js"],
  theme: {
    extend: {
      colors: {
        brand: "#6d28d9",
        "brand-dark": "#4c1d95",
        "brand-light": "#ede9fe",
        accent: "#0ea5e9",
        "accent-light": "#e0f2fe",
        teal: "#0d9488",
        "teal-light": "#ccfbf1",
        dark: "#0f172a",
        mid: "#334155",
        muted: "#64748b",
        surface: "#f8fafc",
        border: "#e2e8f0"
      },
      fontFamily: {
        display: ["Plus Jakarta Sans", "sans-serif"],
        body: ["Be Vietnam Pro", "sans-serif"],
        caps: ["Space Grotesk", "sans-serif"]
      }
    }
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/container-queries')]
};
