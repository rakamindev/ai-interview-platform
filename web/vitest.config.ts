import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// Test-only Vite config: jsdom environment + @ alias + jest-dom matchers.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});