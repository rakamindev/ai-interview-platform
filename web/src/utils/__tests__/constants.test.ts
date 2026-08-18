import { describe, expect, it } from "vitest";
import { parseLevel } from "@/utils/constants";

describe("parseLevel", () => {
  it("passes through a numeric level unchanged", () => {
    expect(parseLevel(3)).toBe(3);
    expect(parseLevel(0)).toBe(0);
  });

  it("extracts the digits from an L-prefixed string level", () => {
    expect(parseLevel("L3")).toBe(3);
    expect(parseLevel("L1")).toBe(1);
    expect(parseLevel("L5")).toBe(5);
  });

  it("extracts digits regardless of surrounding non-digit characters", () => {
    expect(parseLevel("level-4")).toBe(4);
  });

  it("falls back to 1 when no digits are present", () => {
    expect(parseLevel("unrated")).toBe(1);
    expect(parseLevel("")).toBe(1);
  });
});
