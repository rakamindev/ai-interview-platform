import { describe, it, expect } from "vitest";
import { parseLevel, LEVEL_LABELS, FIT_GAP_RESULT_LABELS } from "../constants";

describe("constants and parseLevel", () => {
  it("parses numbers correctly", () => {
    expect(parseLevel(1)).toBe(1);
    expect(parseLevel(3)).toBe(3);
    expect(parseLevel(5)).toBe(5);
  });

  it("parses level strings correctly (L1 - L5)", () => {
    expect(parseLevel("L1")).toBe(1);
    expect(parseLevel("L3")).toBe(3);
    expect(parseLevel("L5")).toBe(5);
    expect(parseLevel("level 4")).toBe(4);
  });

  it("safely handles null, undefined, and empty string without throwing", () => {
    expect(parseLevel(null as any)).toBe(1);
    expect(parseLevel(undefined as any)).toBe(1);
    expect(parseLevel("")).toBe(1);
    expect(parseLevel("unknown")).toBe(1);
  });

  it("has valid level labels from L1 to L5", () => {
    expect(LEVEL_LABELS[1]).toBe("L1");
    expect(LEVEL_LABELS[2]).toBe("L2");
    expect(LEVEL_LABELS[3]).toBe("L3");
    expect(LEVEL_LABELS[4]).toBe("L4");
    expect(LEVEL_LABELS[5]).toBe("L5");
  });

  it("has valid fit/gap result labels", () => {
    expect(FIT_GAP_RESULT_LABELS.match).toBe("Match");
    expect(FIT_GAP_RESULT_LABELS.gap).toBe("Gap");
    expect(FIT_GAP_RESULT_LABELS.exceed).toBe("Exceeds");
    expect(FIT_GAP_RESULT_LABELS.not_assessed).toBe("Not assessed");
  });
});
