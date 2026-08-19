import { describe, it, expect } from "vitest";
import { parseLevel } from "@/utils/constants";

describe("parseLevel", () => {
  it("parses L-formatted strings", () => {
    expect(parseLevel("L1")).toBe(1);
    expect(parseLevel("L3")).toBe(3);
    expect(parseLevel("L5")).toBe(5);
  });

  it("passes through integers in the valid range", () => {
    expect(parseLevel(2)).toBe(2);
    expect(parseLevel(4)).toBe(4);
  });

  it("returns null for out-of-range levels instead of fabricating a value", () => {
    expect(parseLevel(0)).toBeNull();
    expect(parseLevel(6)).toBeNull();
    expect(parseLevel(99)).toBeNull();
  });

  it("returns null for unassessed / missing levels", () => {
    expect(parseLevel(null)).toBeNull();
    expect(parseLevel(undefined)).toBeNull();
    expect(parseLevel("")).toBeNull();
  });
});
