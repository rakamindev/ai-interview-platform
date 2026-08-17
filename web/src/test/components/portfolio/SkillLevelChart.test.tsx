import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SkillLevelChart from "@/components/portfolio/SkillLevelChart";
import type { PortfolioSkill, AssessorOverride } from "@/types";

function skill(overrides: Partial<PortfolioSkill> = {}): PortfolioSkill {
  return {
    id: 1,
    skill_label: "React",
    is_discovered: false,
    ai_level: 3,
    ai_confidence: "high",
    evidence: [],
    competency_summary: "",
    ...overrides,
  };
}

function override(overrides: Partial<AssessorOverride> = {}): AssessorOverride {
  return {
    id: 1,
    portfolio_skill_id: 1,
    ai_level: 3,
    override_level: 5,
    assessor_notes: "",
    ...overrides,
  };
}

describe("SkillLevelChart", () => {
  it("renders a row per skill with a numeric ai_level", () => {
    render(<SkillLevelChart skills={[skill({ id: 1, skill_label: "React", ai_level: 3 })]} overrides={{}} />);

    expect(screen.getAllByText("React").length).toBeGreaterThan(0);
    expect(screen.getAllByText("L3").length).toBeGreaterThan(0);
  });

  it("parses a string ai_level like 'L4'", () => {
    render(<SkillLevelChart skills={[skill({ ai_level: "L4" })]} overrides={{}} />);

    expect(screen.getAllByText("L4").length).toBeGreaterThan(0);
  });

  it("filters out skills with an unparseable or null ai_level", () => {
    render(
      <SkillLevelChart
        skills={[skill({ id: 1, skill_label: "Unassessed", ai_level: null })]}
        overrides={{}}
      />
    );

    expect(screen.queryByText("Unassessed")).not.toBeInTheDocument();
  });

  it("renders nothing when every skill is filtered out", () => {
    const { container } = render(
      <SkillLevelChart skills={[skill({ ai_level: null })]} overrides={{}} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("uses the assessor override level instead of ai_level, marked with an asterisk", () => {
    render(
      <SkillLevelChart
        skills={[skill({ id: 1, ai_level: 2 })]}
        overrides={{ 1: override({ portfolio_skill_id: 1, override_level: 5 }) }}
      />
    );

    expect(screen.getByText("L5")).toBeInTheDocument();
    expect(screen.getByText("*")).toBeInTheDocument();
  });
});
