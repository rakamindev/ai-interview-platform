import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ command }) => ({
    // Dependencies can reference the whole import.meta.env object. Exclude the development
    // credential at build time as well as guarding its use in authAtom.
    envPrefix: command === "build" ? [
        "VITE_API_BASE_URL", "VITE_WS_BASE_URL", "VITE_REQUIRE_CAMERA",
        "VITE_SPEED_TEST_PING_URL", "VITE_SPEED_TEST_UPLOAD_URL",
        "VITE_DEV_TENANT_ID", "VITE_DEV_TENANT_NAME",
    ] : "VITE_",
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
}));
