export const TIME_LIMIT_OPTIONS = [10, 30, 45, 60, 90] as const;

/** Parse "L3" → 3, passthrough number, fallback to 1 */
export function parseLevel(level: string | number): number {
  if (typeof level === "number") return level;
  const n = parseInt(level.replace(/\D/g, ""), 10);
  return isNaN(n) ? 1 : n;
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

// L-badge colors (Tailwind classes with high-contrast text and subtle borders)
export const LEVEL_BADGE_CLASSES: Record<number, string> = {
  1: "bg-slate-100 text-slate-700 border-slate-200",
  2: "bg-sky-50 text-sky-800 border-sky-200",
  3: "bg-[#0F8F95]/10 text-[#0B7479] border-[#0F8F95]/25",
  4: "bg-indigo-50 text-indigo-800 border-indigo-200",
  5: "bg-amber-50 text-amber-900 border-amber-300",
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
  not_yet: "bg-slate-200",
  initiated: "bg-sky-300",
  partial: "bg-[#0F8F95]/60",
  covered: "bg-[#0F8F95]",
};

// Fit/Gap result display
export const FIT_GAP_RESULT_LABELS: Record<string, string> = {
  match: "Match",
  gap: "Gap",
  exceed: "Exceeds",
  not_assessed: "Not assessed",
};

export const FIT_GAP_RESULT_CLASSES: Record<string, string> = {
  match: "text-emerald-800 bg-emerald-50 border-emerald-200",
  gap: "text-amber-900 bg-amber-50 border-amber-300",
  exceed: "text-[#0B7479] bg-[#0F8F95]/10 border-[#0F8F95]/30",
  not_assessed: "text-slate-600 bg-slate-100/80 border-slate-300",
};
