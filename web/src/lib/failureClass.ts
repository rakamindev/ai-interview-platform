// How a session failure is described to the assessor.
//
// The backend records one of four classes and nothing more specific (see
// Session::FAILURE_CLASSES in the Rails app), because a class is what an
// assessor can actually act on: it says whether inviting the same candidate
// again is worth it, whether the problem is ours at all, and whether anyone
// needs to be called. Before this existed, every unexpected ending was shown
// as a single word — "failed" — which left the assessor to guess between
// waiting, retrying, and escalating.
//
// Keeping the wording here rather than inline at each call site means the
// description an assessor reads is the same on the session list and on the
// live monitor.

export type FailureClass = "user" | "transient" | "config" | "permanent";

export interface FailureDescription {
  /** Short phrase shown next to the session status. */
  label: string;
  /** What the assessor should do next. This is the part that was missing. */
  action: string;
}

const DESCRIPTIONS: Record<FailureClass, FailureDescription> = {
  user: {
    label: "candidate connection lost",
    action:
      "The problem was on the candidate's side — the microphone, the device, or the browser never coming back. It is safe to invite the same candidate again.",
  },
  transient: {
    label: "interview provider unavailable",
    action:
      "The interview provider could not be reached after every retry was exhausted. Wait and try again later — this was not the candidate's fault.",
  },
  config: {
    label: "configuration problem",
    action:
      "A model or API key is missing or invalid. Fix the configuration before inviting anyone; retrying on its own will not help.",
  },
  permanent: {
    label: "unexpected error",
    action:
      "Something failed in our own code. Escalate to engineering rather than re-running the interview.",
  },
};

/**
 * Returns the description for a class, or null when the value is absent or
 * unrecognised. Unknown values are deliberately not invented on the spot: the
 * backend can grow a fifth class, and a confident explanation that is wrong
 * would be worse for the assessor than showing no explanation at all.
 */
export function describeFailureClass(
  failureClass?: string | null
): FailureDescription | null {
  if (!failureClass) return null;
  return DESCRIPTIONS[failureClass as FailureClass] ?? null;
}
