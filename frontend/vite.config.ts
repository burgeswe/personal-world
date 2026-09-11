import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/healthz": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/fonts": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/companions": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/icons": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});