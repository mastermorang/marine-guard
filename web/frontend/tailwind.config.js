module.exports = {
  content: ["./frontend/index.html", "./frontend/src/**/*.{js,jsx}"],
  theme: {
    extend: {
      boxShadow: {
        panel: "0 24px 40px rgba(30, 54, 84, 0.08)",
        soft: "0 12px 24px rgba(30, 54, 84, 0.06)",
        float: "0 8px 20px rgba(37, 50, 75, 0.18)"
      },
      colors: {
        marine: {
          50: "#f7f9fc",
          100: "#f2f4f8",
          200: "#e4e9f1",
          300: "#c9d1dc",
          500: "#8a96a8",
          700: "#1f3149",
          800: "#113f67",
          900: "#0d5679"
        }
      },
      fontFamily: {
        sans: ["Roboto", "Noto Sans KR", "sans-serif"]
      }
    }
  },
  plugins: []
};
