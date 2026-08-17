import { describe, it, expect } from "vitest";
import { buildVerdict } from "./portfolioVerdict";
import type { PortfolioSkill } from "@/types";

function skill(overrides: Partial<PortfolioSkill> = {}): PortfolioSkill {
  return {
    id: 1,
    skill_label: "Skill",
    is_discovered: false,
    ai_level: 3,
    ai_confidence: "medium",
    evidence: [],
    competency_summary: "",
    ...overrides,
  };
}

describe("buildVerdict", () => {
  it("returns null when there are no assessed skills", () => {
    expect(buildVerdict([], {})).toBeNull();
  });

  it("names both strengths and concerns when both exist", () => {
    const skills = [
      skill({ id: 1, skill_label: "API Design", ai_level: 5 }),
      skill({ id: 2, skill_label: "System Design", ai_level: 2 }),
    ];
    const verdict = buildVerdict(skills, {});
    expect(verdict).toContain("Strong on API Design");
    expect(verdict).toContain("Less certain on System Design");
  });

  it("treats a low-confidence rating as a concern even at a mid level", () => {
    const skills = [skill({ id: 1, skill_label: "Testing", ai_level: 3, ai_confidence: "low" })];
    const verdict = buildVerdict(skills, {});
    expect(verdict).toMatch(/narrow, inconclusive/);
  });

  it("reports consistent performance when nothing stands out either way", () => {
    const skills = [
      skill({ id: 1, skill_label: "A", ai_level: 3, ai_confidence: "high" }),
      skill({ id: 2, skill_label: "B", ai_level: 3, ai_confidence: "medium" }),
    ];
    expect(buildVerdict(skills, {})).toMatch(/Solid, consistent/);
  });

  it("an assessor override cancels out an AI low-confidence flag", () => {
    const skills = [skill({ id: 1, skill_label: "Testing", ai_level: 1, ai_confidence: "low" })];
    const overrides = { 1: { id: 1, portfolio_skill_id: 1, ai_level: 1, override_level: 4 } as any };
    const verdict = buildVerdict(skills, overrides);
    expect(verdict).toMatch(/Strong across the board/);
  });
});
