import { describe, expect, it } from "vitest";

import { parseLevel } from "@/utils/constants";

describe("parseLevel", () => {
  it("accepts L1–L5 as numbers or labels", () => {
    expect(parseLevel(4)).toBe(4);
    expect(parseLevel("L3")).toBe(3);
  });

  it("never turns a missing or invalid rating into a level", () => {
    expect(parseLevel(null)).toBeNull();
    expect(parseLevel(undefined)).toBeNull();
    expect(parseLevel("N/A")).toBeNull();
    expect(parseLevel(0)).toBeNull();
    expect(parseLevel(6)).toBeNull();
    expect(parseLevel(2.5)).toBeNull();
  });
});
