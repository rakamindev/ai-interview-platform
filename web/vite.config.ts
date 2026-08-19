import { defineConfig, lazyPlugins } from "vite-plus";
import react from "@vitejs/plugin-react";

// Node global (config runs under Node); declared locally to avoid pulling in @types/node.
declare const process: { env: Record<string, string | undefined> };

// Fail a production build if VITE_DEV_TOKEN is set — it would bake a shared dev
// auth token into the public client bundle (an auth bypass). Dev/test builds are
// unaffected.
function guardDevTokenPlugin() {
  return {
    name: "guard-dev-token",
    config(_config: unknown, env: { command: string; mode: string }) {
      if (env.command === "build" && env.mode === "production" && process.env.VITE_DEV_TOKEN) {
        throw new Error(
          "[security] VITE_DEV_TOKEN must be empty for production builds — it would bake a shared auth token into the client bundle.",
        );
      }
    },
  };
}

export default defineConfig({
  fmt: {},
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    testTimeout: 15000,
    hookTimeout: 20000,
    maxWorkers: 4,
    server: {
      deps: {
        inline: ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"],
      },
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/test/**",
        "src/main.tsx",
        "src/**/*.d.ts",
        "src/types/**",
      ],
      reporter: ["text-summary", "text"],
      thresholds: {
        statements: 95,
        lines: 95,
        functions: 95,
        branches: 90,
      },
    },
  },
  plugins: [guardDevTokenPlugin(), lazyPlugins(() => [react()])],
  resolve: {
    tsconfigPaths: true,
  },
  build: {
    rollupOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name(moduleId) {
                if (["react", "react-dom", "react-router-dom"].some((x) => moduleId.includes(x))) {
                  return "vendor-react";
                }
                if (
                  ["axios", "jotai", "lucide-react", "react-hook-form"].some((x) =>
                    moduleId.includes(x),
                  )
                ) {
                  return "vendor-misc";
                }
                if (moduleId.includes("@radix-ui")) {
                  return "vendor-ui";
                }
                return null;
              },
            },
          ],
        },
        // manualChunks: {
        //   "vendor-react": ["react", "react-dom", "react-router-dom"],
        //   "vendor-ui": [
        //     "@radix-ui/react-dialog",
        //     "@radix-ui/react-select",
        //     "@radix-ui/react-tabs",
        //     "@radix-ui/react-alert-dialog",
        //     "@radix-ui/react-dropdown-menu",
        //   ],
        //   "vendor-misc": ["axios", "jotai", "lucide-react", "react-hook-form"],
        // },
      },
    },
  },
});
