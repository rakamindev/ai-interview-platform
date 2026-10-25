import { describe, expect, test } from "vitest";
import { parseLevel } from "../constants";

describe("parseLevel", () => {
  test("parses numeric string", () => {
    expect(parseLevel("L3")).toBe(3);
  });

  test("returns fallback for invalid string", () => {
    expect(parseLevel("not-a-level")).toBe(1);
  });

  test("passes through numbers", () => {
    expect(parseLevel(4)).toBe(4);
  });
});
