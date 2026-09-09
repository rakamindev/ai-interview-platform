import { describe, expect, it } from "vitest";
import { getCandidateAccessState } from "./candidateAccessState";

const candidate = {
  session_id: 42,
  role_title: "Frontend Engineer",
  time_limit_min: 45,
  session_status: "pending",
};

describe("getCandidateAccessState", () => {
  it("keeps the interview unavailable until public session metadata has loaded", () => {
    expect(getCandidateAccessState(null, false)).toBe("loading");
  });

  it("allows a pending or active candidate session to start", () => {
    expect(getCandidateAccessState(candidate, false)).toBe("ready");
    expect(getCandidateAccessState({ ...candidate, session_status: "active" }, false)).toBe("ready");
  });

  it("distinguishes a completed session from an unavailable invite", () => {
    expect(getCandidateAccessState({ ...candidate, session_status: "ended" }, false)).toBe("completed");
    expect(getCandidateAccessState(null, true)).toBe("unavailable");
    expect(getCandidateAccessState({ ...candidate, session_status: "failed" }, false)).toBe("unavailable");
  });
});
