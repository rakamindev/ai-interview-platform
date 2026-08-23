import { m } from "@/paraglide/messages.js";

export const RECONNECT_DELAYS = [1000, 2000, 4000] as const;

export const TIME_LIMIT_OPTIONS = [10, 30, 45, 60, 90] as const;

export const POLL_DEADLINE_MS = 120_000; // 2 minutes

/** Parse "L3" → 3, passthrough number, return 0 for garbage input */
export function parseLevel(level: string | number): number {
  if (typeof level === "number") return level;
  const n = parseInt(level.replace(/\D/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

export const LEVEL_LABELS: Record<number, string> = {
  1: "L1",
  2: "L2",
  3: "L3",
  4: "L4",
  5: "L5"
};

export const LEVEL_DESCRIPTIONS: Record<number, string> = {
  1: m.constants_level_1(),
  2: m.constants_level_2(),
  3: m.constants_level_3(),
  4: m.constants_level_4(),
  5: m.constants_level_5()
};

// L-badge colors (Tailwind classes)
export const LEVEL_BADGE_CLASSES: Record<number, string> = {
  1: "bg-neutral-200 text-neutral-700",
  2: "bg-blue-100 text-blue-700",
  3: "bg-teal-100 text-teal-700",
  4: "bg-purple-100 text-purple-700",
  5: "bg-yellow-100 text-yellow-700"
};

// Coverage state display
export const COVERAGE_STATE_LABELS: Record<string, string> = {
  not_yet: m.constants_coverage_not_yet(),
  initiated: m.constants_coverage_initiated(),
  partial: m.constants_coverage_partial(),
  covered: m.constants_coverage_covered()
};

export const COVERAGE_STATE_WIDTH: Record<string, number> = {
  not_yet: 0,
  initiated: 25,
  partial: 60,
  covered: 100
};

export const COVERAGE_STATE_COLOR: Record<string, string> = {
  not_yet: "bg-neutral-200",
  initiated: "bg-blue-300",
  partial: "bg-teal-400",
  covered: "bg-teal-600"
};

// Fit/Gap result display
export const FIT_GAP_RESULT_LABELS: Record<string, string> = {
  match: m.constants_fitgap_match(),
  gap: m.constants_fitgap_gap(),
  exceed: m.constants_fitgap_exceeds(),
  not_assessed: m.constants_fitgap_not_assessed(),
  insufficient_evidence: m.constants_fitgap_insufficient()
};

// Session end reason display — mirrors Session::END_REASONS in the backend
export const SESSION_END_REASON_LABELS: Record<string, string> = {
  manual_candidate: m.constants_session_ended_by_candidate(),
  manual_assessor: m.constants_session_ended_by_assessor(),
  all_covered: m.constants_all_covered(),
  time_ceiling: m.constants_session_ended_by_timeout(),
  error: m.constants_session_ended_by_error()
};

export const FIT_GAP_RESULT_CLASSES: Record<string, string> = {
  match: "text-verdict-match bg-verdict-match/10",
  gap: "text-verdict-gap bg-verdict-gap/10",
  exceed: "text-verdict-exceed bg-verdict-exceed/10",
  not_assessed: "text-verdict-unknown bg-verdict-unknown/10",
  insufficient_evidence: "text-verdict-unknown bg-verdict-unknown/10"
};
