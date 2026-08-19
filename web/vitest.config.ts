import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    test: {
        environment: "jsdom",
        env: {
            VITE_API_BASE_URL: "http://localhost:3001/api/v1",
        },
    },
});
