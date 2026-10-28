import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

// Separate from vite.config.ts so the production build config (manualChunks
// etc.) stays untouched by test-only concerns.
export default mergeConfig(
    viteConfig,
    defineConfig({
        test: {
            environment: "jsdom",
            setupFiles: ["./src/test/setup.ts"],
            globals: true,
        },
    })
);
