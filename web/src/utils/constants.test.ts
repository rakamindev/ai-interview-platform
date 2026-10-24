import { describe, it, expect } from "vitest";
import {
  parseLevel,
  LEVEL_LABELS,
  LEVEL_DESCRIPTIONS,
  FIT_GAP_RESULT_LABELS,
  COVERAGE_STATE_LABELS,
} from "./constants";

describe("constants & helpers", () => {
  describe("parseLevel", () => {
    it("returns the number directly when given 1 to 5", () => {
      expect(parseLevel(1)).toBe(1);
      expect(parseLevel(3)).toBe(3);
      expect(parseLevel(5)).toBe(5);
    });

    it("parses string representations like 'L3' or 'level 4'", () => {
      expect(parseLevel("L1")).toBe(1);
      expect(parseLevel("L3")).toBe(3);
      expect(parseLevel("Level 4")).toBe(4);
      expect(parseLevel("5")).toBe(5);
    });
  });

  describe("LEVEL_LABELS & DESCRIPTIONS", () => {
    it("has entries for L1 through L5", () => {
      expect(LEVEL_LABELS[1]).toBe("L1");
      expect(LEVEL_LABELS[5]).toBe("L5");
      expect(LEVEL_DESCRIPTIONS[1]).toBe("Foundational");
      expect(LEVEL_DESCRIPTIONS[3]).toBe("Proficient");
      expect(LEVEL_DESCRIPTIONS[5]).toBe("Expert");
    });
  });

  describe("FIT_GAP_RESULT_LABELS", () => {
    it("maps all fit results including not_assessed", () => {
      expect(FIT_GAP_RESULT_LABELS.match).toBe("Match");
      expect(FIT_GAP_RESULT_LABELS.gap).toBe("Gap");
      expect(FIT_GAP_RESULT_LABELS.exceed).toBe("Exceeds");
      expect(FIT_GAP_RESULT_LABELS.not_assessed).toBe("Not assessed");
    });
  });

  describe("COVERAGE_STATE_LABELS", () => {
    it("maps coverage states accurately", () => {
      expect(COVERAGE_STATE_LABELS.not_yet).toBe("not yet");
      expect(COVERAGE_STATE_LABELS.initiated).toBe("initiated");
      expect(COVERAGE_STATE_LABELS.partial).toBe("partial");
      expect(COVERAGE_STATE_LABELS.covered).toBe("covered");
    });
  });
});
