import { describe, it, expect } from "vitest";
import { outcomeFromEndReason } from "@/lib/interviewOutcome";

describe("outcomeFromEndReason", () => {
  it.each([
    ["all_covered"],
    ["manual_candidate"],
    ["manual_assessor"],
  ])("treats %s as a completed interview", (reason) => {
    expect(outcomeFromEndReason(reason)).toBe("completed");
  });

  it("treats time_ceiling as its own timed-out outcome, not a plain success", () => {
    expect(outcomeFromEndReason("time_ceiling")).toBe("timed_out");
  });

  it("reports the backend's error reason as an error", () => {
    expect(outcomeFromEndReason("error")).toBe("error");
  });

  // This is the regression guard for the Step 3 Candidate P0: the old code path
  // ignored the reason entirely and always rendered success.
  it("never reads a missing reason as success", () => {
    expect(outcomeFromEndReason(undefined)).toBe("error");
    expect(outcomeFromEndReason(null)).toBe("error");
    expect(outcomeFromEndReason("")).toBe("error");
  });

  it("never reads an unrecognised future reason as success", () => {
    expect(outcomeFromEndReason("gemini_quota_exhausted")).toBe("error");
    expect(outcomeFromEndReason("invalid_link")).toBe("error");
  });

  it("is tolerant of casing and stray whitespace from the wire", () => {
    expect(outcomeFromEndReason("  All_Covered ")).toBe("completed");
  });
});
