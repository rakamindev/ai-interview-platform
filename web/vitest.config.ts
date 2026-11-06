import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

// Mewarisi vite.config.ts (alias "@/", plugin React) supaya tes memakai
// resolusi modul yang sama dengan aplikasi.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/**/*.test.{ts,tsx}"],
      css: false,
      coverage: {
        provider: "v8",
        reporter: ["text", "html", "json-summary"],
        include: ["src/**/*.{ts,tsx}"],
        exclude: ["src/test/**", "src/**/*.test.{ts,tsx}", "src/main.tsx", "src/vite-env.d.ts"],
      },
    },
  })
);
