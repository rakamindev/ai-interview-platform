/**
 * Centralized color tokens — single source of truth for the app's palette.
 *
 * Default to Tailwind's semantic utility classes (bg-primary, text-muted-
 * foreground, border-border, ...) when styling components — they already
 * track light/dark mode via the CSS custom properties defined in
 * `src/index.css`.
 *
 * Reach for the raw values below only when a Tailwind utility can't express
 * what you need — inline SVG fill/stroke, canvas, gradient stops, or a
 * surface (like the auth brand panel) that isn't one of the semantic tokens.
 *
 * Keep this file and `src/index.css` in sync: if a value changes here for a
 * token that also has a CSS variable, update both.
 */

export const brand = {
  /** Dark teal surface — auth brand panel, marketing sections. Not a
   *  semantic Tailwind token, so components reach for this directly. */
  tealDark: "#063E42",
  /** Primary — Rakamin teal. Mirrors --primary in index.css. */
  teal: "#01959F",
  /** Secondary — Rakamin yellow. Mirrors --secondary in index.css. */
  yellow: "#FBC037",
} as const;

export const neutral = {
  ink: "#111827",
  bg: "#F7F9FA",
  border: "#E2E8F0",
  white: "#FFFFFF",
} as const;

export const semantic = {
  destructive: "#DC2626",
  success: "#16A34A",
  warning: "#D97706",
} as const;

/** Teal → yellow duotone used by WaveformSignature and any other place that
 *  wants the brand's "signal" gradient. */
export const waveformGradient = [brand.teal, brand.yellow] as const;

export const colors = { ...brand, ...neutral, ...semantic } as const;

export type ColorToken = keyof typeof colors;
