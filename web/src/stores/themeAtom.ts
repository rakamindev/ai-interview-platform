import { atom } from "jotai";

const STORAGE_KEY = "theme";

export type Theme = "light" | "dark";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem(STORAGE_KEY, theme);
}

export const themeAtom = atom<Theme, [Theme], void>(
  getInitialTheme(),
  (_get, set, update) => {
    set(themeAtom, update);
    applyTheme(update);
  }
);

// Apply on first load
applyTheme(getInitialTheme());
