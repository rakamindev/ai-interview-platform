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

// Coverage state display.
//
// "Not probed" is written out rather than left as an empty bar, because it is
// the one state an assessor can still act on while the interview is running.
export const COVERAGE_STATE_LABELS: Record<string, string> = {
  not_yet: "Not probed",
  initiated: "Opened",
  partial: "Partly covered",
  covered: "Covered",
};

/** Segments filled on the coverage track. Three steps after the untouched state. */
export const COVERAGE_SEGMENTS_FILLED: Record<string, number> = {
  not_yet: 0,
  initiated: 1,
  partial: 2,
  covered: 3,
};
