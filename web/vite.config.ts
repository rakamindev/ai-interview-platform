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
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-ui": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-alert-dialog",
            "@radix-ui/react-dropdown-menu",
          ],
          "vendor-misc": ["axios", "jotai", "lucide-react", "react-hook-form"],
        },
      },
    },
  },
  server: {
    port: 5174, // Ensure it runs on the expected port
    host: true, // Listen on all network interfaces
    allowedHosts: [
      "rakamin.agusetyawan.com",
      "127.0.0.1",
      "localhost",
      // Add other hosts if needed, e.g., 'localhost', '127.0.0.1'
    ],
  },
});
