import React from "react";
import { useAtom } from "jotai";
import { themeAtom, type Theme } from "@/stores/themeAtom";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  variant?: "button" | "segmented";
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className, variant = "button" }) => {
  const [theme, setTheme] = useAtom(themeAtom);

  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className={cn(
        "h-9 w-9 rounded-xl border border-border/80 bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all shadow-sm active:scale-95",
        className
      )}
      title={isDark ? "Beralih ke Mode Terang (Light Mode)" : "Beralih ke Mode Gelap (Dark Mode)"}
      aria-label="Toggle theme"
    >
      {isDark ? (
        <Moon className="h-4 w-4 text-amber-400" />
      ) : (
        <Sun className="h-4 w-4 text-amber-500" />
      )}
    </Button>
  );
};

export default ThemeToggle;
