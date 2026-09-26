/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    "vendor-react": ["react", "react-dom", "react-router-dom"],
                    "vendor-ui": ["@radix-ui/react-dialog", "@radix-ui/react-select", "@radix-ui/react-tabs", "@radix-ui/react-alert-dialog", "@radix-ui/react-dropdown-menu"],
                    "vendor-misc": ["axios", "jotai", "lucide-react", "react-hook-form"],
                },
            },
        },
    },
    test: {
        environment: "jsdom",
        setupFiles: ["./src/test/setup.ts"],
        // Vitest empties CSS files by default; the colour-contrast test reads the real index.css.
        css: { include: [/src\/index\.css/] },
        coverage: {
            provider: "v8",
            reporter: ["text", "html"],
            include: ["src/**/*.{ts,tsx}"],
        },
    },
});
