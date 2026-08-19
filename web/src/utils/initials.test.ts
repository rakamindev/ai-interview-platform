import { describe, it, expect } from "vitest";
import { getInitials } from "./initials";

describe("getInitials", () => {
  it("returns first-letter + last-letter for a two-word name", () => {
    expect(getInitials("Jane Doe")).toBe("JD");
  });

  it("uses the first and last of a multi-word name, ignoring the middle", () => {
    expect(getInitials("Jane Middle Doe")).toBe("JD");
  });

  it("returns the first two letters for a single-word name", () => {
    expect(getInitials("Madonna")).toBe("MA");
  });

  it("falls back to '?' for an empty or whitespace-only name", () => {
    expect(getInitials("")).toBe("?");
    expect(getInitials("   ")).toBe("?");
  });

  it("collapses repeated whitespace between words", () => {
    expect(getInitials("Jane    Doe")).toBe("JD");
  });

  it("always returns uppercase, regardless of input case", () => {
    expect(getInitials("jane doe")).toBe("JD");
  });
});
