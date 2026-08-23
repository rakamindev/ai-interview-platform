import { describe, it, expect } from "vitest";
import { parseLevel } from "@/utils/constants";

describe("parseLevel", () => {
  it("handles numbers directly", () => {
    expect(parseLevel(3)).toBe(3);
    expect(parseLevel(5)).toBe(5);
  });

  it("handles legacy L-prefixed strings", () => {
    expect(parseLevel("L3")).toBe(3);
    expect(parseLevel("L5")).toBe(5);
  });

  it("falls back gracefully for invalid input", () => {
    expect(parseLevel("garbage")).toBe(1);
    expect(parseLevel(0)).toBe(0);
  });
});
