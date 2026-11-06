import { describe, expect, it } from "vitest";
import {
  getCandidateAccessCopy,
  resolveCandidateAccessError,
  resolveCandidateAccessFromError,
} from "./candidateAccess";

describe("resolveCandidateAccessError", () => {
  it.each([
    ["invite_not_found", "not_found"],
    ["invite_expired", "expired"],
    ["invite_revoked", "revoked"],
    ["invite_completed", "completed"],
    ["invite_in_progress", "in_progress"],
  ])("maps %s to %s", (code, expected) => {
    expect(resolveCandidateAccessError(410, code)).toBe(expected);
  });

  it("prefers the server code over the HTTP status", () => {
    // A 410 with a revoked code must say revoked, not expired.
    expect(resolveCandidateAccessError(410, "invite_revoked")).toBe("revoked");
  });

  it("falls back to status when the code is missing", () => {
    expect(resolveCandidateAccessError(404)).toBe("not_found");
    expect(resolveCandidateAccessError(410)).toBe("expired");
  });

  it("treats network failures and 5xx responses as retryable", () => {
    expect(resolveCandidateAccessError(undefined)).toBe("network");
    expect(resolveCandidateAccessError(0)).toBe("network");
    expect(resolveCandidateAccessError(503)).toBe("network");
  });

  it("does not retry genuine link failures", () => {
    for (const error of ["not_found", "expired", "revoked", "completed", "in_progress"] as const) {
      expect(getCandidateAccessCopy(error).retry).toBeFalsy();
    }
  });
});

describe("resolveCandidateAccessFromError", () => {
  it("reads the Rails error envelope", () => {
    const error = {
      response: {
        status: 410,
        data: { errors: [{ status: 410, message: "gone", code: "invite_revoked" }] },
      },
    };
    expect(resolveCandidateAccessFromError(error)).toBe("revoked");
  });

  it("handles non-axios errors", () => {
    expect(resolveCandidateAccessFromError(new Error("boom"))).toBe("network");
  });
});

describe("candidate copy", () => {
  it("has distinct English and Indonesian copy for every state", () => {
    const states = [
      "not_found",
      "expired",
      "revoked",
      "completed",
      "in_progress",
      "network",
      "unknown",
    ] as const;

    for (const state of states) {
      const en = getCandidateAccessCopy(state, "en");
      const id = getCandidateAccessCopy(state, "id");
      expect(en.title).toBeTruthy();
      expect(id.title).toBeTruthy();
      expect(id.title).not.toBe(en.title);
    }
  });

  it("never tells an expired candidate they completed the interview", () => {
    const expired = getCandidateAccessCopy("expired", "en");
    expect(expired.title.toLowerCase()).toContain("expired");
    expect(expired.title.toLowerCase()).not.toContain("completed");
  });
});
