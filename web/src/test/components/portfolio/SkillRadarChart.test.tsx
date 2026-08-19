import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SkillRadarChart from "@/components/portfolio/SkillRadarChart";
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

const THREE_SKILLS = [
  skill({ id: 1, skill_label: "React", ai_level: 3 }),
  skill({ id: 2, skill_label: "Node.js", ai_level: 4 }),
  skill({ id: 3, skill_label: "SQL", ai_level: 2 }),
];

describe("SkillRadarChart", () => {
  it("shows an explanatory empty state instead of blank space with fewer than 3 assessed skills", () => {
    render(<SkillRadarChart skills={[skill({ id: 1, ai_level: 3 })]} overrides={{}} />);

    expect(screen.getByText(/Needs at least 3 assessed skills/)).toBeInTheDocument();
    expect(screen.getByText(/Only 1 assessed so far/)).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("shows the empty state with zero assessed skills too, without an 'Only 0' caveat", () => {
    render(<SkillRadarChart skills={[skill({ ai_level: null })]} overrides={{}} />);

    expect(screen.getByText(/Needs at least 3 assessed skills/)).toBeInTheDocument();
    expect(screen.queryByText(/Only/)).not.toBeInTheDocument();
  });

  it("renders an accessible radar chart with 3 or more assessed skills", () => {
    render(<SkillRadarChart skills={THREE_SKILLS} overrides={{}} />);

    const svg = screen.getByRole("img");
    expect(svg).toHaveAttribute(
      "aria-label",
      "Skill profile radar chart: React at level 3, Node.js at level 4, SQL at level 2"
    );
  });

  it("includes a screen-reader-only data table alongside the chart", () => {
    render(<SkillRadarChart skills={THREE_SKILLS} overrides={{}} />);

    expect(screen.getByText("Skill profile levels, 1 to 5")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "L3" })).toBeInTheDocument();
  });

  it("truncates axis labels longer than 14 characters", () => {
    render(
      <SkillRadarChart
        skills={[
          ...THREE_SKILLS.slice(0, 2),
          skill({ id: 3, skill_label: "Distributed Systems Architecture", ai_level: 2 }),
        ]}
        overrides={{}}
      />
    );

    expect(screen.getByText("Distributed S…")).toBeInTheDocument();
  });

  it("uses the assessor override level instead of ai_level when present", () => {
    render(
      <SkillRadarChart
        skills={THREE_SKILLS}
        overrides={{ 1: override({ portfolio_skill_id: 1, override_level: 5 }) }}
      />
    );

    const svg = screen.getByRole("img");
    expect(svg.getAttribute("aria-label")).toContain("React at level 5");
  });
});
