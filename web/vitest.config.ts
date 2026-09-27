import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
    viteConfig,
    defineConfig({
        test: {
            environment: "jsdom",
            clearMocks: true,
            setupFiles: ["./src/test/setup.ts"],
        },
    }),
);
