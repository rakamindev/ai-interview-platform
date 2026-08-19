export const TIME_LIMIT_OPTIONS = [10, 30, 45, 60, 90] as const;

// Auth pages copy — centralized so Login/Signup wording changes in one place.
export const AUTH_COPY = {
  brandTagline: "Every candidate heard, every signal measured.",
  login: {
    title: "Sign in to AI Interview",
    description: "Manage assessments and review candidate interviews.",
    submit: "Sign in",
    submitting: "Signing in…",
    error: "Email or password is incorrect.",
    footerPrompt: "New here?",
    footerCta: "Create account",
  },
  signup: {
    title: "Create your account",
    description: "Set up access to manage assessments.",
    submit: "Create account",
    submitting: "Creating account…",
    error: "We couldn't create your account. Check your details and try again.",
    footerPrompt: "Already have an account?",
    footerCta: "Sign in",
  },
} as const;

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
