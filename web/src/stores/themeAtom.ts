import { atom } from "jotai";

export type Theme = "light" | "dark" | "system";

const THEME_STORAGE_KEY = "rakamin_theme";

const getInitialTheme = (): Theme => {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
  if (stored && ["light", "dark", "system"].includes(stored)) {
    return stored;
  }
  return "system";
};

export const applyTheme = (theme: Theme) => {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
};

const baseThemeAtom = atom<Theme>(getInitialTheme());

// Initialize immediately on load
if (typeof window !== "undefined") {
  applyTheme(getInitialTheme());

  // Listen to OS theme changes when in system mode
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
      if (!stored || stored === "system") {
        applyTheme("system");
      }
    });
}

export const themeAtom = atom(
  (get) => get(baseThemeAtom),
  (_get, set, newTheme: Theme) => {
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    applyTheme(newTheme);
    set(baseThemeAtom, newTheme);
  }
);
