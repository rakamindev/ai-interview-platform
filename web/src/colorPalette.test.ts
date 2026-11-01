// @ts-expect-error Vitest runs in Node, while the application tsconfig intentionally stays browser-only.
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

declare const process: { cwd: () => string };

const stylesheet = readFileSync(`${process.cwd()}/src/index.css`, "utf8");

const expectedPalette = {
  "--rakamin-teal": "50 140 149",
  "--rakamin-dark-teal": "33 102 111",
  "--rakamin-yellow": "245 196 81",
  "--rakamin-cream": "255 253 240",
  "--rakamin-light-cyan": "233 247 247",
  "--rakamin-charcoal": "41 41 41",
  "--rakamin-gray": "119 119 119",
  "--rakamin-white": "255 255 255",
};

describe("Rakamin color palette", () => {
  beforeAll(() => {
    const rootRule = stylesheet.match(/:root\s*\{[^}]*\}/)?.[0];
    expect(rootRule).toBeDefined();

    const style = document.createElement("style");
    style.textContent = rootRule!;
    document.head.appendChild(style);
    document.documentElement.classList.remove("dark");
  });

  it("exposes the exact brand colors as global design tokens", () => {
    const styles = getComputedStyle(document.documentElement);

    Object.entries(expectedPalette).forEach(([token, channels]) => {
      expect(styles.getPropertyValue(token).trim()).toBe(channels);
    });
  });

  it("maps brand colors to the light theme semantic roles", () => {
    const styles = getComputedStyle(document.documentElement);

    expect(styles.getPropertyValue("--background").trim()).toBe("var(--rakamin-white)");
    expect(styles.getPropertyValue("--foreground").trim()).toBe("var(--rakamin-charcoal)");
    expect(styles.getPropertyValue("--card").trim()).toBe("var(--rakamin-white)");
    expect(styles.getPropertyValue("--primary").trim()).toBe("var(--rakamin-dark-teal)");
    expect(styles.getPropertyValue("--secondary").trim()).toBe("var(--rakamin-yellow)");
    expect(styles.getPropertyValue("--muted").trim()).toBe("var(--rakamin-light-cyan)");
  });
});
