import { describe, expect, it } from "vitest";
import { clampText, decide, requiredLevel } from "./decision";

describe("requiredLevel", () => {
  it("reads required_level and falls back to the legacy expected_level field", () => {
    expect(requiredLevel({ required_level: 4, expected_level: 1 })).toBe(4);
    expect(requiredLevel({ expected_level: 3 })).toBe(3);
    expect(requiredLevel({ expected_level: null, required_level: null })).toBeNull();
  });
});

describe("decide", () => {
  it("holds when a required skill was never assessed", () => {
    const decision = decide([
      { skill_label: "React", result: "match", confidence: "high" },
      { skill_label: "SQL", result: "not_assessed" },
    ]);

    expect(decision.verdict).toBe("hold");
    expect(decision.blockingSkills).toEqual(["SQL"]);
    expect(decision.counts.not_assessed).toBe(1);
  });

  it("holds a low-confidence exceed instead of treating it as a pass", () => {
    const decision = decide([{ skill_label: "React", result: "exceed", confidence: "low" }]);

    expect(decision.verdict).toBe("hold");
    expect(decision.lowConfidenceSkills).toEqual(["React"]);
  });

  it("declines only a confident gap after every skill is assessed", () => {
    const decision = decide([
      { skill_label: "React", result: "match", confidence: "high" },
      { skill_label: "SQL", result: "gap", confidence: "medium" },
    ]);

    expect(decision.verdict).toBe("decline");
    expect(decision.blockingSkills).toEqual(["SQL"]);
  });

  it("advances a fully covered bar", () => {
    const decision = decide([
      { skill_label: "React", result: "match", confidence: "high" },
      { skill_label: "SQL", result: "exceed", confidence: "medium" },
    ]);

    expect(decision.verdict).toBe("advance");
    expect(decision.blockingSkills).toEqual([]);
  });

  it("holds an empty requirement list", () => {
    expect(decide([]).verdict).toBe("hold");
  });
});

describe("clampText", () => {
  it("keeps short copy and marks long copy", () => {
    expect(clampText("  short   note ", 20)).toEqual({ text: "short note", truncated: false });
    const long = "a".repeat(40);
    expect(clampText(long, 10).truncated).toBe(true);
    expect(clampText(long, 10).text.endsWith("…")).toBe(true);
  });
});
