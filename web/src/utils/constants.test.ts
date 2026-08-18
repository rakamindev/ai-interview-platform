import { describe, it, expect } from "vitest";
import { parseLevel, LEVEL_LABELS } from "./constants";

describe("parseLevel", () => {
  it("parses L3-style strings", () => {
    expect(parseLevel("L3")).toBe(3);
    expect(parseLevel("L1")).toBe(1);
  });

  it("passes numbers through", () => {
    expect(parseLevel(4)).toBe(4);
  });

  it("falls back to 1 on garbage instead of crashing", () => {
    expect(parseLevel("unknown")).toBe(1);
    expect(parseLevel("")).toBe(1);
  });
});

describe("LEVEL_LABELS", () => {
  it("covers all five levels used by the API", () => {
    expect([1, 2, 3, 4, 5].map((n) => LEVEL_LABELS[n])).toEqual(["L1", "L2", "L3", "L4", "L5"]);
  });
});