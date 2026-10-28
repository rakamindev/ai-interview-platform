export const TIME_LIMIT_OPTIONS = [10, 30, 45, 60, 90] as const;

/** Parse "L3" → 3, passthrough number, mengembalikan null jika input null/undefined/invalid */
export function parseLevel(level: string | number | null | undefined): number | null {
  if (level === null || level === undefined) return null;
  if (typeof level === "number") return level >= 1 && level <= 5 ? level : null;
  if (typeof level !== "string") return null;
  const n = parseInt(level.replace(/\D/g, ""), 10);
  return isNaN(n) ? null : n;
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

// L-badge colors (Tailwind classes)
export const LEVEL_BADGE_CLASSES: Record<number, string> = {
  1: "bg-neutral-200 text-neutral-700",
  2: "bg-blue-100 text-blue-700",
  3: "bg-teal-100 text-teal-700",
  4: "bg-purple-100 text-purple-700",
  5: "bg-yellow-100 text-yellow-700",
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
  not_yet: "bg-neutral-200",
  initiated: "bg-blue-300",
  partial: "bg-teal-400",
  covered: "bg-teal-600",
};

// Fit/Gap result display
export const FIT_GAP_RESULT_LABELS: Record<string, string> = {
  match: "Match",
  gap: "Gap",
  exceed: "Exceeds",
  not_assessed: "Not assessed",
};

export const FIT_GAP_RESULT_CLASSES: Record<string, string> = {
  match: "text-emerald-700 bg-emerald-50/70 border-emerald-200",
  gap: "text-rose-700 bg-rose-50/70 border-rose-200",
  exceed: "text-indigo-700 bg-indigo-50/70 border-indigo-200",
  not_assessed: "text-slate-600 bg-slate-50 border-slate-200",
};
