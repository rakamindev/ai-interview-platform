import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { paraglideVitePlugin } from "@inlang/paraglide-js";

export default defineConfig({
    plugins: [
        react(),
        paraglideVitePlugin({
            project: "./project.inlang",
            outdir: "./src/paraglide",
            emitTsDeclarations: true,
        }),
        tailwindcss(),
    ],
    resolve: {
        alias: {
            "@": `${import.meta.dirname}/src`,
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes("node_modules/react") || id.includes("node_modules/react-dom") || id.includes("node_modules/react-router")) {
                        return "vendor-react";
                    }
                    if (id.includes("node_modules/@radix-ui")) {
                        return "vendor-ui";
                    }
                    if (id.includes("node_modules/axios") || id.includes("node_modules/jotai") || id.includes("node_modules/lucide-react") || id.includes("node_modules/react-hook-form")) {
                        return "vendor-misc";
                    }
                },
            },
        },
    },
});
