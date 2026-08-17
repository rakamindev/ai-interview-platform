import { describe, it, expect } from "vitest";
import { interviewUrl } from "./invite";

describe("interviewUrl", () => {
  it("builds the invite URL from the web origin, not the API origin", () => {
    expect(interviewUrl("tok123")).toBe(
      `${window.location.origin}/interview/tok123`
    );
  });
});
