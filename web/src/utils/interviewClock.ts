import type { InterviewState } from "@/types";

/** Whether the interview timer counts down in this state. */
export function timerRuns(state: InterviewState): boolean {
  // The server's time ceiling keeps counting while the browser reconnects, so this does too (P2-25); not while
  // wrapping up, where expiring would cut off the interviewer's closing words.
  return state === "active" || state === "reconnecting";
}
