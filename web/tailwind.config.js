/** @type {import('tailwindcss').Config} */
export default {
    content: ["./index.html", "./src/**/*.{ts,tsx}"],
    theme: {
        extend: {
            fontFamily: {
                display: ["Sora", "Segoe UI", "system-ui", "sans-serif"],
                sans: ["Inter", "Segoe UI", "system-ui", "sans-serif"],
                mono: ["JetBrains Mono", "SFMono-Regular", "Consolas", "monospace"],
            },
            colors: {
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                /* Redesign brand palette (named "brand"/"sun" to keep Tailwind's
                   built-in teal/yellow scales intact for existing classes) */
                brand: {
                    DEFAULT: "var(--teal)",
                    deep: "var(--teal-deep)",
                    deeper: "var(--teal-deeper)",
                    soft: "var(--teal-soft)",
                    softer: "var(--teal-softer)",
                },
                sun: {
                    DEFAULT: "var(--yellow)",
                    soft: "var(--yellow-soft)",
                },
                surface: {
                    DEFAULT: "var(--brand-surface)",
                    alt: "var(--surface-alt)",
                },
                faint: "var(--faint)",
                /* Redesign semantics (named to avoid clobbering Tailwind's green/amber/red scales) */
                ok: {
                    DEFAULT: "var(--green)",
                    soft: "var(--green-soft)",
                },
                warn: {
                    DEFAULT: "var(--amber)",
                    soft: "var(--amber-soft)",
                },
                danger: {
                    DEFAULT: "var(--red)",
                    soft: "var(--red-soft)",
                },
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
            keyframes: {
                "accordion-down": {
                    from: { height: "0" },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: "0" },
                },
                "voice-bar": {
                    "0%, 100%": { height: "8px" },
                    "50%": { height: "36px" },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
                "voice-bar": "voice-bar 0.9s ease-in-out infinite",
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
};
