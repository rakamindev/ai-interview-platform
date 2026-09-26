import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SkillPortfolioCard from "./SkillPortfolioCard";
import type { PortfolioSkill } from "@/types";

const skill = (overrides: Partial<PortfolioSkill>): PortfolioSkill => ({
  id: 1,
  skill_label: "Leadership & Ownership",
  is_discovered: false,
  status: "not_assessed",
  ai_level: null,
  ai_confidence: null,
  evidence: [],
  competency_summary: null,
  ...overrides,
});

const renderCard = (s: PortfolioSkill) =>
  render(<SkillPortfolioCard skill={s} onOverrideSaved={() => {}} />);

describe("SkillPortfolioCard", () => {
  it("shows a skill the interview never reached as not assessed, with no level", () => {
    const { container } = renderCard(skill({ status: "not_assessed" }));

    expect(screen.getByText("Not assessed")).toBeInTheDocument();
    expect(screen.getByText(/did not reach this skill/)).toBeInTheDocument();
    expect(screen.queryByText(/^L[1-5]$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Confidence/)).not.toBeInTheDocument();
    expect(container.querySelector("[data-skill-state]")).toHaveAttribute("data-skill-state", "not_assessed");
  });

  it("shows an unusable AI answer as our problem, not the candidate's", () => {
    renderCard(skill({ status: "unavailable" }));

    expect(screen.getByText("Could not be evaluated")).toBeInTheDocument();
    expect(screen.getByText(/not a judgement of the candidate/)).toBeInTheDocument();
    expect(screen.queryByText(/^L[1-5]$/)).not.toBeInTheDocument();
  });

  it("offers no review for a skill without a level", () => {
    renderCard(skill({ status: "not_assessed" }));

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("still shows the level and confidence of a rated skill", () => {
    renderCard(skill({ status: "assessed", ai_level: 3, ai_confidence: "high", competency_summary: "Leads calmly." }));

    expect(screen.getByText("L3")).toBeInTheDocument();
    expect(screen.getByText("Confidence: HIGH")).toBeInTheDocument();
  });
});
