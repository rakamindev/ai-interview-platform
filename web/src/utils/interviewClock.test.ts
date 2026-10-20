import { describe, expect, it } from "vitest";
import { timerRuns } from "./interviewClock";

describe("timerRuns", () => {
  it("counts down during the interview, not before it starts or after it ends", () => {
    expect(timerRuns("active")).toBe(true);
    for (const state of ["idle", "connecting", "ending", "complete"] as const) {
      expect(timerRuns(state), state).toBe(false);
    }
  });

  // The server's clock (its time ceiling) doesn't stop while the browser reconnects, so the candidate's mustn't
  // either: each reconnect used to add its length to the time shown. Not while wrapping up: expiring then would cut
  // off the interviewer's closing words.
  it("P2-25: keeps counting while reconnecting, and stops while the interview wraps up", () => {
    expect(timerRuns("reconnecting")).toBe(true);
    expect(timerRuns("draining_audio")).toBe(false);
  });
});
