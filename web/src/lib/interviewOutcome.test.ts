import { describe, expect, it } from "vitest";
import { endScreen, outcomeFor, type EndSignal, type InterviewOutcome } from "./interviewOutcome";

const RECORDED_CLAIM = /sent to the hiring team|recorded/i;

describe("outcomeFor (W26)", () => {
  const cases: Array<[EndSignal, InterviewOutcome]> = [
    [{ kind: "candidate_ended" }, "completed"],
    [{ kind: "session_ended", reason: "all_covered" }, "completed"],
    [{ kind: "session_ended", reason: "time_limit" }, "completed"],
    [{ kind: "session_ended", reason: "error" }, "interrupted"],
    [{ kind: "server_error" }, "interrupted"],
    [{ kind: "connection_lost" }, "interrupted"],
    [{ kind: "link_not_found" }, "invalid_link"],
    [{ kind: "link_load_failed" }, "load_failed"],
    [{ kind: "already_ended" }, "already_ended"],
  ];

  it.each(cases)("%o -> %s", (signal, expected) => {
    expect(outcomeFor(signal)).toBe(expected);
  });
});

describe("endScreen (W26)", () => {
  it("only the completed outcome claims the answers reached the hiring team", () => {
    expect(endScreen("completed").body).toMatch(RECORDED_CLAIM);
    for (const outcome of ["interrupted", "invalid_link", "load_failed", "already_ended"] as const) {
      expect(endScreen(outcome).body).not.toMatch(RECORDED_CLAIM);
      expect(endScreen(outcome).tone).not.toBe("success");
    }
  });

  it("an interrupted interview tells the candidate it did not finish and who to contact", () => {
    const screen = endScreen(outcomeFor({ kind: "session_ended", reason: "error" }));
    expect(screen.title).toMatch(/didn't finish/);
    expect(screen.body).toMatch(/contact the hiring team/);
  });
});
