import { afterEach, describe, expect, it, vi } from "vitest";

import { getInterviewClientId } from "@/utils/interviewClientId";

describe("getInterviewClientId", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("returns the same 32-character hex id across calls in this browser", () => {
    const id = getInterviewClientId();

    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(getInterviewClientId()).toBe(id);
    expect(localStorage.getItem("interview_client_id")).toBe(id);
  });

  it("still returns an id when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(getInterviewClientId()).toMatch(/^[0-9a-f]{32}$/);
  });
});
