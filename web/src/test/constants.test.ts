import { describe, it, expect } from "vitest";
import { parseLevel } from "@/utils/constants";

describe("parseLevel utility", () => {
  it("parses valid level numbers", () => {
    expect(parseLevel(1)).toBe(1);
    expect(parseLevel(3)).toBe(3);
    expect(parseLevel(5)).toBe(5);
  });

  it("clamps levels between 1 and 5", () => {
    expect(parseLevel(0)).toBe(1);
    expect(parseLevel(7)).toBe(5);
    expect(parseLevel(-2)).toBe(1);
  });

  it("parses level strings with prefix", () => {
    expect(parseLevel("L1")).toBe(1);
    expect(parseLevel("L4")).toBe(4);
    expect(parseLevel("level 5")).toBe(5);
  });

  it("handles null, undefined and invalid inputs defensively without throwing", () => {
    expect(parseLevel(null)).toBe(1);
    expect(parseLevel(undefined)).toBe(1);
    expect(parseLevel("invalid")).toBe(1);
    expect(parseLevel(NaN)).toBe(1);
  });
});
