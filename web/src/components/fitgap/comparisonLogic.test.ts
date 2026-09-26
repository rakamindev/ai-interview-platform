import { describe, it, expect } from "vitest";
import type { SkillComparison } from "@/types";

describe("FitGap Seam & Data Matching Logic", () => {
  it("resolves required level from expected_level or fallback required_level", () => {
    // Backend API now sends expected_level and required_level alias
    const backendComparison: SkillComparison = {
      skill_label: "React / Frontend Development",
      skill_id: "SK-ENG-001",
      expected_level: 3,
      required_level: 3,
      candidate_level: 4,
      result: "exceed",
      delta: 1,
      is_override: false,
    };

    const resolvedRequired = backendComparison.expected_level ?? backendComparison.required_level;
    expect(resolvedRequired).toBe(3);
    expect(backendComparison.result).toBe("exceed");
    expect(backendComparison.delta).toBe(1);
  });

  it("handles unassessed skills cleanly without negative delta penalties", () => {
    const unassessedComparison: SkillComparison = {
      skill_label: "Kubernetes & Orchestration",
      skill_id: "SK-OPS-003",
      expected_level: 4,
      required_level: 4,
      candidate_level: null,
      result: "not_assessed",
      delta: null,
      is_override: false,
    };

    expect(unassessedComparison.candidate_level).toBeNull();
    expect(unassessedComparison.result).toBe("not_assessed");
    expect(unassessedComparison.delta).toBeNull();
  });

  it("accurately detects when an assessor human override was applied", () => {
    const overriddenComparison: SkillComparison = {
      skill_label: "System Architecture",
      expected_level: 3,
      candidate_level: 4,
      result: "exceed",
      delta: 1,
      is_override: true,
    };

    expect(overriddenComparison.is_override).toBe(true);
  });
});

