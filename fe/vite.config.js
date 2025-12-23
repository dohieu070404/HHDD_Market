import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Frontend gọi /api/* -> proxy qua backend (docker) http://localhost:8080
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
