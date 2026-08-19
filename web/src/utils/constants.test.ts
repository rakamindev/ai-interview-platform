import { describe, it, expect } from "vite-plus/test";
import {
  TIME_LIMIT_OPTIONS,
  parseLevel,
  LEVEL_LABELS,
  LEVEL_DESCRIPTIONS,
  LEVEL_BADGE_CLASSES,
  COVERAGE_STATE_LABELS,
  COVERAGE_STATE_WIDTH,
  COVERAGE_STATE_COLOR,
  FIT_GAP_RESULT_LABELS,
  FIT_GAP_RESULT_CLASSES,
} from "./constants";

describe("constants", () => {
  it("exposes the time limit options in order", () => {
    expect(TIME_LIMIT_OPTIONS).toEqual([10, 30, 45, 60, 90]);
  });

  describe("parseLevel", () => {
    it("returns numbers as-is", () => {
      expect(parseLevel(3)).toBe(3);
      expect(parseLevel(0)).toBe(0);
    });

    it("parses the numeric part of level strings", () => {
      expect(parseLevel("L3")).toBe(3);
      expect(parseLevel("L10")).toBe(10);
      expect(parseLevel("Level 5")).toBe(5);
    });

    it("falls back to 1 when no digits are present", () => {
      expect(parseLevel("LX")).toBe(1);
      expect(parseLevel("")).toBe(1);
    });

    it("falls back to 1 when the parsed value is NaN", () => {
      expect(parseLevel("abc")).toBe(1);
    });
  });

  it("maps levels 1-5 to labels, descriptions, and badge classes", () => {
    expect(LEVEL_LABELS).toEqual({ 1: "L1", 2: "L2", 3: "L3", 4: "L4", 5: "L5" });
    expect(LEVEL_DESCRIPTIONS[3]).toBe("Proficient");
    expect(LEVEL_BADGE_CLASSES[5]).toContain("bg-yellow-100");
  });

  it("maps coverage states to labels, widths, and colors", () => {
    expect(COVERAGE_STATE_LABELS.partial).toBe("partial");
    expect(COVERAGE_STATE_WIDTH).toEqual({ not_yet: 0, initiated: 25, partial: 60, covered: 100 });
    expect(COVERAGE_STATE_COLOR.covered).toBe("bg-teal-600");
  });

  it("maps fit/gap results to labels and classes", () => {
    expect(FIT_GAP_RESULT_LABELS).toEqual({
      match: "Match",
      gap: "Gap",
      exceed: "Exceeds",
      not_assessed: "Not assessed",
    });
    expect(FIT_GAP_RESULT_CLASSES.gap).toBe("text-amber-700 bg-amber-50");
  });
});
