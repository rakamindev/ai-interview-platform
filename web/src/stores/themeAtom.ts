import { atom } from "jotai";

/**
 * Light, dark, or whatever the operating system says.
 *
 * The stylesheet has carried a full dark palette since the baseline, and this
 * revamp added dark variants for every result colour on top of it — all of it
 * unreachable, because Tailwind is configured `darkMode: ["class"]` and nothing
 * ever put that class on the document. Forty lines of CSS that could not be
 * seen.
 *
 * "system" is the default and a real option rather than just a starting value:
 * someone whose machine turns dark at sunset should not have to come back here
 * and turn it again.
 */
export type Theme = "system" | "light" | "dark";

const STORAGE_KEY = "theme";
const THEMES: Theme[] = ["system", "light", "dark"];

export function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return THEMES.includes(stored as Theme) ? (stored as Theme) : "system";
  } catch {
    // Private mode, or storage disabled. Following the OS is a safe default.
    return "system";
  }
}

export function prefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
}

/** Puts the class on <html>, which is the only thing Tailwind's dark: variant reads. */
export function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && prefersDark());
  document.documentElement.classList.toggle("dark", dark);
}

export function storeTheme(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Not being able to remember the choice is survivable; failing to apply it
    // is not, so this never throws.
  }
}

/** Cycle order for the single header control: system → light → dark → system. */
export function nextTheme(theme: Theme): Theme {
  return THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
}

export const themeAtom = atom<Theme>(readStoredTheme());
