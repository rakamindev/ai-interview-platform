import { describe, it, expect } from "vitest";
import { controlMessageToState, closeDecision, sessionOutcome, sessionStatusToState } from "@/utils/interviewState";
import type { WsControlMessage } from "@/types";

const msg = (m: Partial<WsControlMessage> & { type: WsControlMessage["type"] }) => m as WsControlMessage;

describe("controlMessageToState", () => {
  it("maps a clean full end to complete", () => {
    expect(controlMessageToState(msg({ type: "session_ended" }))).toBe("complete");
    expect(controlMessageToState(msg({ type: "session_ended", reason: "all_covered" }))).toBe("complete");
    expect(controlMessageToState(msg({ type: "session_ended", reason: "time_ceiling" }))).toBe("complete");
  });

  it("maps a candidate early end to ended_early, not complete", () => {
    const s = controlMessageToState(msg({ type: "session_ended", reason: "manual_candidate" }));
    expect(s).toBe("ended_early");
    expect(s).not.toBe("complete");
  });

  it("maps a retryable failure to failed_retryable — never complete", () => {
    const s = controlMessageToState(msg({ type: "session_failed", retryable: true }));
    expect(s).toBe("failed_retryable");
    expect(s).not.toBe("complete");
  });

  it("maps a non-retryable failure to failed_terminal — never complete", () => {
    const s = controlMessageToState(msg({ type: "session_failed", retryable: false }));
    expect(s).toBe("failed_terminal");
    expect(s).not.toBe("complete");
  });

  it("treats a non-recoverable error as an honest failure, not complete", () => {
    expect(controlMessageToState(msg({ type: "error", recoverable: false }))).toBe("failed_terminal");
  });

  it("ignores a recoverable error (no visible state change)", () => {
    expect(controlMessageToState(msg({ type: "error", recoverable: true }))).toBeNull();
  });

  it("maps the lifecycle messages", () => {
    expect(controlMessageToState(msg({ type: "session_started" }))).toBe("active");
    expect(controlMessageToState(msg({ type: "reconnecting" }))).toBe("reconnecting");
    expect(controlMessageToState(msg({ type: "reconnected" }))).toBe("active");
    expect(controlMessageToState(msg({ type: "preparing_to_end" }))).toBe("draining_audio");
  });

  it("returns null for side-effect-only messages", () => {
    expect(controlMessageToState(msg({ type: "transcription" }))).toBeNull();
    expect(controlMessageToState(msg({ type: "speaker_changed" }))).toBeNull();
  });

  // The #5 regression guard and the seeded-fault target: no failure-ish message may resolve to
  // "complete". If someone reverts the routing so a failure shows the success screen, this fails.
  it("never resolves any failure to complete", () => {
    const failures: WsControlMessage[] = [
      msg({ type: "session_failed", retryable: true }),
      msg({ type: "session_failed", retryable: false }),
      msg({ type: "error", recoverable: false }),
    ];
    for (const f of failures) expect(controlMessageToState(f)).not.toBe("complete");
  });
});

// The single reading of stored status used by the invite list, the assessments list and the
// candidate screen. The assessments list once had its own copy, which showed a failed interview
// as "Awaiting candidate".
describe("sessionOutcome", () => {
  it("reads every finished outcome", () => {
    expect(sessionOutcome("ended", "all_covered")).toBe("completed");
    expect(sessionOutcome("ended", "time_ceiling")).toBe("completed");
    expect(sessionOutcome("ended", "manual_assessor")).toBe("completed");
    expect(sessionOutcome("ended", "manual_candidate")).toBe("early_end");
  });

  it("reads unfinished sessions", () => {
    expect(sessionOutcome("pending", null)).toBe("awaiting");
    expect(sessionOutcome("active", null)).toBe("live");
  });

  it("never reports a failed session as awaiting or completed — new or legacy", () => {
    for (const [status, reason] of [["failed", "error"], ["ended", "error"]] as const) {
      const outcome = sessionOutcome(status, reason);
      expect(outcome).toBe("failed");
      expect(outcome).not.toBe("awaiting");
      expect(outcome).not.toBe("completed");
    }
  });
});

// AC-6: what the candidate sees when they reload the invite link after the interview is over.
describe("sessionStatusToState", () => {
  it("shows complete for a full end", () => {
    expect(sessionStatusToState("ended", "all_covered")).toBe("complete");
    expect(sessionStatusToState("ended", "time_ceiling")).toBe("complete");
  });

  it("shows ended_early for a candidate early end", () => {
    expect(sessionStatusToState("ended", "manual_candidate")).toBe("ended_early");
  });

  it("shows the interruption screen for a failed session", () => {
    expect(sessionStatusToState("failed", "error")).toBe("failed_terminal");
  });

  // Existing rows: failures written before the `failed` status existed are stored as ended/error and
  // were deliberately not migrated. They must never reload as a success.
  it("treats a legacy ended/error row as an interruption, never complete", () => {
    const s = sessionStatusToState("ended", "error");
    expect(s).toBe("failed_terminal");
    expect(s).not.toBe("complete");
  });

  it("stays on the start screen for an interview that hasn't finished", () => {
    expect(sessionStatusToState("pending", null)).toBeNull();
    expect(sessionStatusToState("active", null)).toBeNull();
  });
});

describe("closeDecision", () => {
  const MAX = 3;

  it("ignores a clean/deliberate end — never a failure", () => {
    expect(closeDecision(true, 0, MAX)).toBe("ignore");
    // Even with reconnects exhausted, a deliberate end (End Interview / timer) must not fail.
    expect(closeDecision(true, MAX, MAX)).toBe("ignore");
  });

  it("reconnects while attempts remain", () => {
    expect(closeDecision(false, 0, MAX)).toBe("reconnect");
    expect(closeDecision(false, MAX - 1, MAX)).toBe("reconnect");
  });

  it("fails only on an exhausted reconnect with no clean end", () => {
    expect(closeDecision(false, MAX, MAX)).toBe("fail");
  });
});
