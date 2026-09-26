import { describe, expect, it } from "vitest";
import css from "../index.css?raw";

// Reads the colour tokens from index.css and checks them against WCAG 2.2 AA,
// so a colour change that makes text hard to read fails here, not in production.
const rootBlock = css.slice(css.indexOf(":root"), css.indexOf(".dark"));

function token(name: string): [number, number, number] {
  const match = rootBlock.match(new RegExp(`--${name}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`));
  if (!match) throw new Error(`Missing colour token --${name}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function hslToRgb([h, s, l]: [number, number, number]): number[] {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  return [0, 8, 4].map((n) => light - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)));
}

function luminance(rgb: number[]): number {
  const [r, g, b] = rgb.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: string, background: string): number {
  const [a, b] = [luminance(hslToRgb(token(foreground))), luminance(hslToRgb(token(background)))];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const TEXT = 4.5; // body text and labels
const UI = 3; // borders, focus rings and other non-text parts

const pairs: [string, string, number][] = [
  ["foreground", "background", TEXT],
  ["muted-foreground", "background", TEXT],
  ["muted-foreground", "muted", TEXT],
  ["primary-foreground", "primary", TEXT],
  ["primary-foreground", "primary-strong", TEXT],
  ["primary", "background", TEXT],
  ["primary-strong", "primary-soft", TEXT],
  ["destructive-foreground", "destructive", TEXT],
  ["success", "background", TEXT],
  ["success", "success-soft", TEXT],
  ["attention", "background", TEXT],
  ["attention", "attention-soft", TEXT],
  ["critical", "background", TEXT],
  ["critical", "critical-soft", TEXT],
  ["info", "background", TEXT],
  ["info", "info-soft", TEXT],
  ["input", "background", UI],
  ["input", "muted", UI],
  ["ring", "background", UI],
  ["attention-line", "background", UI],
  ["primary", "muted", UI],
];

describe("colour tokens", () => {
  it.each(pairs)("%s on %s reaches %s:1", (foreground, background, minimum) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(minimum);
  });
});
