/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx}"],
    theme: {
        extend: {
            colors: {
                border: "hsl(var(--border) / <alpha-value>)",
                input: "hsl(var(--input) / <alpha-value>)",
                ring: "hsl(var(--ring) / <alpha-value>)",
                background: "hsl(var(--background) / <alpha-value>)",
                foreground: "hsl(var(--foreground) / <alpha-value>)",
                primary: {
                    DEFAULT: "hsl(var(--primary) / <alpha-value>)",
                    foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
                    strong: "hsl(var(--primary-strong) / <alpha-value>)",
                    soft: "hsl(var(--primary-soft) / <alpha-value>)",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
                    foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
                    foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted) / <alpha-value>)",
                    foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent) / <alpha-value>)",
                    foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
                },
                card: {
                    DEFAULT: "hsl(var(--card) / <alpha-value>)",
                    foreground: "hsl(var(--card-foreground) / <alpha-value>)",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover) / <alpha-value>)",
                    foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
                },
                success: {
                    DEFAULT: "hsl(var(--success) / <alpha-value>)",
                    soft: "hsl(var(--success-soft) / <alpha-value>)",
                },
                attention: {
                    DEFAULT: "hsl(var(--attention) / <alpha-value>)",
                    line: "hsl(var(--attention-line) / <alpha-value>)",
                    soft: "hsl(var(--attention-soft) / <alpha-value>)",
                },
                critical: {
                    DEFAULT: "hsl(var(--critical) / <alpha-value>)",
                    soft: "hsl(var(--critical-soft) / <alpha-value>)",
                },
                info: {
                    DEFAULT: "hsl(var(--info) / <alpha-value>)",
                    soft: "hsl(var(--info-soft) / <alpha-value>)",
                },
                brand: {
                    DEFAULT: "hsl(var(--brand) / <alpha-value>)",
                    accent: "hsl(var(--brand-accent) / <alpha-value>)",
                },
            },
            transitionDuration: {
                instant: "100ms",
                quick: "150ms",
                base: "240ms",
                calm: "400ms",
            },
            transitionTimingFunction: {
                standard: "cubic-bezier(0.2, 0, 0.38, 0.9)",
                enter: "cubic-bezier(0, 0, 0.38, 0.9)",
                exit: "cubic-bezier(0.2, 0, 1, 0.9)",
                calm: "cubic-bezier(0.4, 0.14, 0.3, 1)",
            },
            spacing: {
                "app-header": "var(--app-header-h)",
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
                    "0%, 100%": { height: "4px" },
                    "50%": { height: "32px" },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
                "voice-bar": "voice-bar 0.8s ease-in-out infinite",
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
};
