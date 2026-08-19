/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

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
        coverage: {
            provider: "v8",
            reporter: ["text", "html"],
            // Scoped to the STEP 10 test-coverage brief (session lifecycle
            // visibility, AI generation failure transparency, vacancy-context
            // persistence) — most of src/ has no tests yet and isn't part of
            // that scope, so a repo-wide number here would be misleading noise.
            include: [
                "src/utils/formatDuration.ts",
                "src/pages/assessments/AssessmentInvitePage.tsx",
                "src/pages/portfolio/PortfolioPage.tsx",
                "src/pages/transcript/TranscriptPage.tsx",
                "src/pages/fitgap/FitGapReportPage.tsx",
            ],
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
});
