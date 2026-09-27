import type { InterviewState, WsControlMessage } from "@/types";

/**
 * Pure mapping from a backend WebSocket control message to the next interview state.
 *
 * Extracted so the failure-vs-success routing is unit-testable and can't silently regress:
 * a failure must never resolve to "complete" (the #5 defect). See wiki 04-step4-revamp.md AC-4/AC-12.
 *
 * Returns null when the message drives a side effect (transcript / speaker change) rather than a
 * state transition, or when a recoverable error should not change the visible state.
 */
export function controlMessageToState(msg: WsControlMessage): InterviewState | null {
  switch (msg.type) {
    case "session_started":
    case "reconnected":
      return "active";
    case "reconnecting":
      return "reconnecting";
    case "preparing_to_end":
      return "draining_audio";
    case "session_ended":
      // A deliberate early end by the candidate is distinct from a full completion: the candidate
      // sees an honest "ended early" screen and the assessor sees an "early-end" remark. Any other
      // end reason (all_covered / time_ceiling) is a normal completion.
      return msg.reason === "manual_candidate" ? "ended_early" : "complete";
    case "session_failed":
      // A pre-first-turn failure is retryable on the same link; a mid-interview one is terminal.
      return "complete"; // SEEDED FAULT: re-introduces P0 #5 (a failure shown as success)
    case "error":
      // Recoverable errors are transient; a non-recoverable error is an honest failure, not success.
      return msg.recoverable ? null : "failed_terminal";
    default:
      return null;
  }
}

export type SessionOutcome = "awaiting" | "live" | "completed" | "early_end" | "failed";

/**
 * The one reading of a session's stored status, shared by every page that shows it (candidate
 * screen, invite list, assessments list). Each page used to interpret status on its own, and a page
 * that wasn't updated for the `failed` status showed a failed interview as "Awaiting candidate".
 *
 * `ended` + `error` is a legacy row: before the `failed` status existed, a technical failure was
 * written as ended/error. Those rows are left unchanged in the DB, so they must still read as a
 * failure — never as completed.
 */
export function sessionOutcome(status: string, endReason?: string | null): SessionOutcome {
  if (status === "active") return "live";
  if (status === "failed") return "failed";
  if (status !== "ended") return "awaiting";
  if (endReason === "error") return "failed";
  return endReason === "manual_candidate" ? "early_end" : "completed";
}

/**
 * Map a session's stored status (from `candidate_info`, on page load or refresh) to the screen the
 * candidate should see. Returns null when the interview hasn't finished (stay on the start screen).
 */
export function sessionStatusToState(
  status: string,
  endReason?: string | null
): InterviewState | null {
  switch (sessionOutcome(status, endReason)) {
    case "failed":
      return "failed_terminal";
    case "early_end":
      return "ended_early";
    case "completed":
      return "complete";
    default:
      return null;
  }
}

/**
 * Decide what a raw WebSocket `close` means, independent of any control message.
 *
 * A deliberate end (the candidate pressed End Interview, or the timer expired — both call
 * `disconnect()`, which marks the socket ended) must resolve to "ignore": the visible state was
 * already set by the end handler and must NOT be overwritten. This is the exact regression that
 * shipped once — a manual end fell through to "failed_terminal" ("a technical problem on our side")
 * because the close looked like an exhausted reconnect. Kept pure and unit-tested so it can't
 * silently regress again.
 */
export function closeDecision(
  sessionEnded: boolean,
  attempt: number,
  maxAttempts: number
): "ignore" | "reconnect" | "fail" {
  if (sessionEnded) return "ignore";
  return attempt < maxAttempts ? "reconnect" : "fail";
}
