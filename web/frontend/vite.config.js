const path = require("path");
const { defineConfig } = require("vite");
const react = require("@vitejs/plugin-react");

module.exports = defineConfig({
  root: __dirname,
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:3000",
      "/socket.io": "http://127.0.0.1:3000"
    }
  },
  build: {
    outDir: path.resolve(__dirname, "../public"),
    emptyOutDir: false
  }
});
