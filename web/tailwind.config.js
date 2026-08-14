/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx}"],
    theme: {
        extend: {
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
                // Assessment results. Defined once here so no screen invents its
                // own colour for a level comparison.
                result: {
                    exceed: "hsl(var(--result-exceed))",
                    match: "hsl(var(--result-match))",
                    gap: "hsl(var(--result-gap))",
                    none: "hsl(var(--result-none))",
                },
            },
            fontFamily: {
                // Sans carries the interface and anything the machine wrote.
                sans: ["IBM Plex Sans", "ui-sans-serif", "system-ui", "sans-serif"],
                // Mono carries every measurement: levels, deltas, timers, counts.
                mono: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular", "monospace"],
                // Serif is reserved for verbatim candidate speech, so a reader can
                // tell testimony from inference without reading a label.
                serif: ["Source Serif 4", "Georgia", "serif"],
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
