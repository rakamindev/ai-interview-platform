import { defineConfig, lazyPlugins } from "vite-plus";
import react from "@vitejs/plugin-react";

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
  plugins: lazyPlugins(() => [react()]),
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
