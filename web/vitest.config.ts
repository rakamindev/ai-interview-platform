import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// The web app shipped with no test runner at all. This is the smallest setup
// that can assert on rendered output, which is where the fit/gap defects were
// visible — a type-level contract break renders as a blank cell, and tsc
// cannot see it because the data crosses an unvalidated axios boundary.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
