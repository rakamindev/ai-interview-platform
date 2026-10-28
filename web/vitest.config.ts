import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// Pengaturan khusus tes frontend. Dipisah dari vite.config.ts supaya build produksi tidak berubah.
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    test: {
        environment: "jsdom",
        include: ["src/**/*.test.{ts,tsx}"],
    },
});
