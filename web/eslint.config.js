import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettier from "eslint-config-prettier";

/**
 * Konfigurasi flat ESLint 10 untuk web/.
 *
 * Prinsip yang dipegang di sini, dan yang perlu bisa dijelaskan di defense:
 *
 * 1. Lint ini dipasang untuk MENANGKAP CACAT, bukan untuk merapikan gaya tulis.
 *    Semua aturan formatting diserahkan ke Prettier — `prettier` diletakkan
 *    paling akhir supaya aturan gaya bawaan ESLint yang bertabrakan dimatikan.
 *    Kalau lint dan formatter memperebutkan file yang sama, yang kalah adalah
 *    review: diff jadi penuh perubahan kosmetik dan cacat aslinya tenggelam.
 *
 * 2. Repo ini belum pernah di-lint. Menyalakan preset ketat sekaligus akan
 *    memunculkan ratusan pelanggaran lama di file yang sama sekali tidak
 *    disentuh perbaikan #4–#8, dan memperbaiki semuanya melebarkan diff jauh
 *    di luar tema "Integritas Penilaian". Jadi: aturan yang menunjuk BUG
 *    dipasang sebagai `error`, aturan yang menunjuk UTANG dipasang `warn`
 *    supaya terlihat di laporan tanpa memerah-kan CI.
 *
 * 3. `src/components/ui/**` adalah komponen shadcn/ui hasil generate, bukan
 *    kode tulisan sendiri. Dia di-ignore dengan alasan yang sama seperti dia
 *    di-exclude dari coverage di vite.config.ts.
 */
export default tseslint.config(
    {
        ignores: ["dist/**", "coverage/**", "node_modules/**", "src/components/ui/**", "public/**"],
    },

    js.configs.recommended,
    tseslint.configs.recommended,

    {
        files: ["src/**/*.{ts,tsx}"],
        languageOptions: {
            ecmaVersion: 2020,
            globals: globals.browser,
        },
        plugins: {
            "react-hooks": reactHooks,
            "react-refresh": reactRefresh,
        },
        rules: {
            // --- Kelas cacat yang benar-benar terjadi di repo ini -------------
            // exhaustive-deps: perbaikan #7 memindahkan fetch ke useCallback
            // justru karena dependency effect-nya tidak lengkap. Ini error,
            // bukan warning.
            "react-hooks/rules-of-hooks": "error",
            "react-hooks/exhaustive-deps": "error",

            // Fast-refresh Vite: file yang meng-export komponen + non-komponen
            // membuat hot reload jatuh ke full reload. `allowConstantExport`
            // menyala karena repo ini mengekspor konstanta bersama komponen.
            "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

            // `==` vs `===`: pola `e?.response?.data?.errors?.[0]?.message ?? …`
            // di services/ bersandar pada perbedaan null-vs-undefined, jadi
            // `== null` sengaja diizinkan lewat opsi "smart"-nya.
            eqeqeq: ["error", "always", { null: "ignore" }],

            // Larangan yang menyasar tipe berbohong. `any` mengembalikan
            // seluruh manfaat `strict: true` ke nol di titik pemakaiannya —
            // dan itulah akar cacat #6 (`ai_level` yang dideklarasi `string`
            // padahal schema.rb mengirim integer).
            "@typescript-eslint/no-explicit-any": "warn",

            // Cast non-null `!` adalah janji yang tidak diperiksa siapa pun.
            // Seluruh perbaikan #4–#6 dikerjakan TANPA satu pun cast, jadi
            // aturan ini menjaga properti itu tetap benar ke depan.
            "@typescript-eslint/no-non-null-assertion": "error",

            // Variabel/argumen tak terpakai: `warn`, dan argumen berawalan `_`
            // dibebaskan karena itu idiom "sengaja diabaikan" yang sudah
            // dipakai di beberapa handler.
            "@typescript-eslint/no-unused-vars": [
                "warn",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_",
                },
            ],

            // `console` di produksi membocorkan payload wawancara ke devtools
            // penonton mana pun. `warn`/`error` tetap boleh karena dipakai
            // untuk kegagalan WebSocket.
            "no-console": ["warn", { allow: ["warn", "error"] }],
        },
    },

    // Test boleh lebih longgar: `any` dalam mock dan variabel bantu yang
    // dibiarkan tidak terpakai bukan cacat produk.
    {
        files: ["src/**/*.{test,spec}.{ts,tsx}", "src/test/**/*.ts"],
        languageOptions: {
            globals: { ...globals.browser, ...globals.node },
        },
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
            "no-console": "off",
        },
    },

    // File konfigurasi berjalan di Node, bukan browser.
    {
        files: ["*.config.{js,ts}", "vite.config.ts", "tailwind.config.js", "postcss.config.js"],
        languageOptions: {
            globals: globals.node,
        },
        rules: {
            "no-console": "off",
        },
    },

    // Harus paling akhir: mematikan aturan ESLint yang bertabrakan dengan Prettier.
    prettier
);
