/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: "#6d28d9",
        "brand-dark": "#4c1d95",
        "brand-light": "#ede9fe",
        dark: "#0f172a",
        mid: "#334155",
        muted: "#64748b",
        surface: "#f8fafc",
        line: "#e2e8f0"
      },
      fontFamily: {
        display: ["Plus Jakarta Sans", "sans-serif"],
        body: ["Be Vietnam Pro", "sans-serif"],
        caps: ["Space Grotesk", "sans-serif"]
      },
      borderRadius: {
        lg: "12px",
        md: "10px",
        sm: "8px"
      }
    }
  },
  plugins: []
};
