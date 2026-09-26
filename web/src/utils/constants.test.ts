import { describe, it, expect } from "vitest";
import { parseLevel, LEVEL_LABELS, FIT_GAP_RESULT_LABELS } from "./constants";

describe("parseLevel - Fair Candidate Evaluation (UU PDP)", () => {
  it("parses valid level strings like 'L3' to number 3", () => {
    expect(parseLevel("L1")).toBe(1);
    expect(parseLevel("L3")).toBe(3);
    expect(parseLevel("L5")).toBe(5);
  });

  it("passes through valid numbers 1-5 directly", () => {
    expect(parseLevel(1)).toBe(1);
    expect(parseLevel(4)).toBe(4);
    expect(parseLevel(5)).toBe(5);
  });

  it("returns null for unassessed, missing, or empty inputs instead of forcing L1", () => {
    // CRITICAL: Must not clamp 0 or null to 1, as that unjustly penalizes candidates!
    expect(parseLevel(null)).toBeNull();
    expect(parseLevel(undefined)).toBeNull();
    expect(parseLevel("")).toBeNull();
    expect(parseLevel(0)).toBeNull();
  });

  it("returns null for invalid or out-of-range levels", () => {
    expect(parseLevel(-1)).toBeNull();
    expect(parseLevel(6)).toBeNull();
    expect(parseLevel("L99")).toBeNull();
    expect(parseLevel("invalid")).toBeNull();
  });
});

describe("Constants Mapping Consistency", () => {
  it("maps levels 1-5 correctly to label strings", () => {
    expect(LEVEL_LABELS[1]).toBe("L1");
    expect(LEVEL_LABELS[2]).toBe("L2");
    expect(LEVEL_LABELS[3]).toBe("L3");
    expect(LEVEL_LABELS[4]).toBe("L4");
    expect(LEVEL_LABELS[5]).toBe("L5");
  });

  it("includes all required fit gap result labels including not_assessed", () => {
    expect(FIT_GAP_RESULT_LABELS["match"]).toBe("Match");
    expect(FIT_GAP_RESULT_LABELS["gap"]).toBe("Gap");
    expect(FIT_GAP_RESULT_LABELS["exceed"]).toBe("Exceeds");
    expect(FIT_GAP_RESULT_LABELS["not_assessed"]).toBe("Not assessed");
  });
});

