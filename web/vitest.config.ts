import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
    viteConfig,
    defineConfig({
        test: {
            environment: "jsdom",
            setupFiles: ["./src/test/setup.ts"],
            css: false,
            include: ["src/**/*.test.{ts,tsx}"], // e2e/ belongs to Playwright
        },
    }),
);
