import { mergeConfig } from "vite";
import { defineConfig as defineVitestConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
    viteConfig,
    defineVitestConfig({
        test: {
            environment: "jsdom",
            globals: true,
            setupFiles: ["./src/test/setup.ts"],
            css: false,
            exclude: ["node_modules", "dist", "e2e"],
        },
    })
);
