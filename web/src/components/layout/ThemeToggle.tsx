import { useEffect } from "react";
import { useAtom } from "jotai";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { themeAtom, applyTheme, storeTheme, nextTheme, type Theme } from "@/stores/themeAtom";

const LABEL: Record<Theme, string> = {
  system: "Match system",
  light: "Light",
  dark: "Dark",
};

const ICON: Record<Theme, typeof Sun> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

/**
 * Keeps the document in sync with the chosen theme.
 *
 * Lives outside the button because the class has to be applied on every screen
 * — the candidate never sees the header, and the login page has no chrome at
 * all, but both should still honour a dark machine.
 */
export function useApplyTheme() {
  const [theme] = useAtom(themeAtom);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;

    // Only while following the system: a machine that turns dark at sunset
    // should take the app with it without anyone pressing anything.
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);
}

/**
 * One button rather than a menu. Three states is few enough to cycle, and the
 * icon says which one you are in without opening anything.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useAtom(themeAtom);
  const Icon = ICON[theme];

  const cycle = () => {
    const next = nextTheme(theme);
    setTheme(next);
    storeTheme(next);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={cycle}
      title={`Theme: ${LABEL[theme]}`}
      data-testid="theme-toggle"
      data-theme-state={theme}
    >
      <Icon className="h-4 w-4" aria-hidden />
      <span className="sr-only">Theme: {LABEL[theme]}. Activate to change.</span>
    </Button>
  );
}
