import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SkillPortfolioCard from "./SkillPortfolioCard";
import type { PortfolioSkill } from "@/types";

describe("SkillPortfolioCard", () => {
  const mockSkill: PortfolioSkill = {
    id: 1,
    skill_id: "SK-ENG-001",
    skill_label: "React / Frontend Development",
    is_discovered: false,
    ai_level: 3,
    ai_confidence: "high",
    evidence: ["Quote showing React knowledge"],
    competency_summary: "Demonstrated strong knowledge of component state and hooks.",
  };

  it("renders skill label and evidence correctly", () => {
    render(
      <SkillPortfolioCard
        skill={mockSkill}
        onOverrideSaved={vi.fn()}
      />
    );

    expect(screen.getByText("React / Frontend Development")).toBeInTheDocument();
    expect(screen.getByText('• "Quote showing React knowledge"')).toBeInTheDocument();
    expect(
      screen.getByText("Demonstrated strong knowledge of component state and hooks.")
    ).toBeInTheDocument();
  });

  it("renders override level when override is present", () => {
    const mockOverride = {
      id: 1,
      portfolio_skill_id: 1,
      ai_level: 3,
      override_level: 4,
      assessor_notes: "Demonstrated L4 during live coding.",
      overridden_by: 1,
      overridden_at: "2026-08-19T00:00:00Z",
    };

    render(
      <SkillPortfolioCard
        skill={mockSkill}
        override={mockOverride}
        onOverrideSaved={vi.fn()}
      />
    );

    expect(screen.getAllByText("L4").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("You Overridden ✓")).toBeInTheDocument();
  });
});
