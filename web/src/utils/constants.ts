export const TIME_LIMIT_OPTIONS = [10, 30, 45, 60, 90] as const;

/** Parse "L3" → 3, passthrough number, fallback to 1 */
export function parseLevel(level: string | number): number {
  if (typeof level === "number") return level;
  const n = parseInt(level.replace(/\D/g, ""), 10);
  return isNaN(n) ? 1 : n;
}

export const LEVEL_LABELS: Record<number, string> = {
  1: "Pemula",
  2: "Dasar",
  3: "Menengah",
  4: "Mahir",
  5: "Ahli",
};

export function getLevelLabel(level: number): string {
  return LEVEL_LABELS[level] ?? `L${level}`;
}

export const LEVEL_DESCRIPTIONS_ID: Record<number, string> = {
  1: "Baru mengenal skill ini, masih perlu banyak panduan.",
  2: "Bisa mengerjakan tugas sederhana dengan panduan.",
  3: "Bisa mengerjakan secara mandiri.",
  4: "Bisa menangani tugas kompleks dan membimbing orang lain.",
  5: "Penguasaan mendalam, menjadi rujukan untuk skill ini.",
};

export function getLevelDescriptionId(level: number): string {
  return LEVEL_DESCRIPTIONS_ID[level] ?? "";
}

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
  match: "text-green-700 bg-green-50",
  gap: "text-amber-700 bg-amber-50",
  exceed: "text-green-700 bg-green-50",
  not_assessed: "text-neutral-500 bg-neutral-50",
};
