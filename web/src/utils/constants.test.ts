import { describe, it, expect } from "vitest";
import {
  parseLevel,
  formatLevel,
  LEVEL_LABELS,
  LEVEL_DESCRIPTIONS,
  TIME_LIMIT_OPTIONS,
} from "./constants";

describe("constants & level helpers", () => {
  describe("parseLevel", () => {
    it("returns number directly when passed a number", () => {
      expect(parseLevel(3)).toBe(3);
      expect(parseLevel(5)).toBe(5);
    });

    it("parses string representations like 'L2' to number", () => {
      expect(parseLevel("L2")).toBe(2);
      expect(parseLevel("Level 4")).toBe(4);
    });

    it("falls back to 1 for unparseable strings", () => {
      expect(parseLevel("unknown")).toBe(1);
      expect(parseLevel("")).toBe(1);
    });
  });

  describe("formatLevel", () => {
    it("formats 1 through 5 as L1..L5", () => {
      expect(formatLevel(1)).toBe("L1");
      expect(formatLevel(2)).toBe("L2");
      expect(formatLevel(3)).toBe("L3");
      expect(formatLevel(4)).toBe("L4");
      expect(formatLevel(5)).toBe("L5");
    });

    it("falls back to L{n} for numbers outside 1..5", () => {
      expect(formatLevel(6)).toBe("L6");
    });
  });

  describe("LEVEL_LABELS & LEVEL_DESCRIPTIONS", () => {
    it("contains entries for levels 1 through 5", () => {
      expect(LEVEL_LABELS[1]).toBe("L1");
      expect(LEVEL_LABELS[5]).toBe("L5");
      expect(LEVEL_DESCRIPTIONS[1]).toBe("Foundational");
      expect(LEVEL_DESCRIPTIONS[3]).toBe("Proficient");
      expect(LEVEL_DESCRIPTIONS[5]).toBe("Expert");
    });
  });

  describe("TIME_LIMIT_OPTIONS", () => {
    it("contains standard interview duration options", () => {
      expect(TIME_LIMIT_OPTIONS).toEqual([10, 30, 45, 60, 90]);
    });
  });
});
