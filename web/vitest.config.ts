import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": `${import.meta.dirname}/src`
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    include: ["src/**/*.test.{ts,tsx}"],
    env: {
      VITE_API_BASE_URL: "http://localhost:3001/api/v1",
      VITE_WS_BASE_URL: "ws://localhost:3001"
    }
  }
});
