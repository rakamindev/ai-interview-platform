export const TIME_LIMIT_OPTIONS = [10, 30, 45, 60, 90] as const;

/** Parse "L3" → 3, passthrough number, returns null for missing / unassessed */
export function parseLevel(level: string | number | null | undefined): number | null {
  if (level === null || level === undefined || level === "" || level === 0 || level === "0") return null;
  if (typeof level === "number") return level >= 1 && level <= 5 ? level : null;
  const n = parseInt(String(level).replace(/\D/g, ""), 10);
  return isNaN(n) || n < 1 || n > 5 ? null : n;
}

export const LEVEL_LABELS: Record<number, string> = {
  1: "L1",
  2: "L2",
  3: "L3",
  4: "L4",
  5: "L5",
};

export const LEVEL_DESCRIPTIONS: Record<number, string> = {
  1: "Foundational",
  2: "Functional",
  3: "Proficient",
  4: "Advanced",
  5: "Expert",
};

// L-badge colors with Dark/Light mode support
export const LEVEL_BADGE_CLASSES: Record<number, string> = {
  1: "bg-slate-100 text-slate-700 border border-slate-300/80 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  2: "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/60",
  3: "bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800/60",
  4: "bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/60",
  5: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60",
};

// Coverage state display
export const COVERAGE_STATE_LABELS: Record<string, string> = {
  not_yet: "not yet",
  initiated: "initiated",
  partial: "partial",
  covered: "covered",
};

export const COVERAGE_STATE_WIDTH: Record<string, number> = {
  not_yet: 0,
  initiated: 25,
  partial: 60,
  covered: 100,
};

export const COVERAGE_STATE_COLOR: Record<string, string> = {
  not_yet: "bg-muted",
  initiated: "bg-blue-400",
  partial: "bg-teal-400",
  covered: "bg-primary",
};

// Fit/Gap result display with Dark/Light theme classes
export const FIT_GAP_RESULT_LABELS: Record<string, string> = {
  match: "Match",
  gap: "Gap",
  exceed: "Exceeds",
  not_assessed: "Not assessed",
};

export const FIT_GAP_RESULT_CLASSES: Record<string, string> = {
  match: "text-emerald-700 bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60",
  gap: "text-amber-700 bg-amber-50 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60",
  exceed: "text-blue-700 bg-blue-50 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/60",
  not_assessed: "text-muted-foreground bg-muted/60 border border-border/80",
};
