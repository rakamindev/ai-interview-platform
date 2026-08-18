import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import type { SkillView } from "@/types";

function skill(overrides: Partial<SkillView> = {}): SkillView {
  return {
    portfolio_skill_id: 1,
    skill_id: "SK-ENG-001",
    skill_label: "React",
    state: "assessed",
    effective_level: 4,
    ai_level: 4,
    ai_confidence: "high",
    coverage_state: "covered",
    probe_count: 3,
    evidence: ["knows hooks well"],
    competency_summary: "Strong React fundamentals.",
    expected_level: 3,
    is_discovered: false,
    override: null,
    ...overrides,
  };
}

describe("SkillPortfolioCard", () => {
  it("shows the effective level for an assessed skill", () => {
    render(<SkillPortfolioCard skill={skill()} onOverrideSaved={vi.fn()} />);
    expect(screen.getByText("L4")).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
  });

  it("never shows a numeric level for a not_assessed skill, and explains why (fairness)", () => {
    render(
      <SkillPortfolioCard
        skill={skill({
          skill_label: "Kubernetes",
          state: "not_assessed",
          effective_level: null,
          ai_level: null,
          ai_confidence: null,
          coverage_state: "not_yet",
          probe_count: 0,
          evidence: [],
          competency_summary: null,
          expected_level: 4,
          portfolio_skill_id: null,
        })}
        onOverrideSaved={vi.fn()}
      />,
    );

    expect(screen.queryByText(/^L[1-5]$/)).not.toBeInTheDocument();
    expect(screen.getByText(/not rated/i)).toBeInTheDocument();
    expect(screen.getByText(/expected L4/i)).toBeInTheDocument();
    // no override control for a skill with no portfolio_skill row
    expect(screen.queryByText(/override/i)).not.toBeInTheDocument();
  });
});
