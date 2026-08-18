import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import type { AssessorOverride, PortfolioSkill } from "@/types";

vi.mock("@/services/portfolios", () => ({
  portfoliosApi: { getOverride: vi.fn() },
}));

const baseSkill: PortfolioSkill = {
  id: 1,
  skill_label: "Communication",
  is_discovered: false,
  ai_level: "L3",
  ai_confidence: "high",
  evidence: ["Explained the tradeoffs clearly."],
  competency_summary: "Communicates clearly under pressure.",
};

describe("SkillPortfolioCard", () => {
  it("renders the skill label, AI level, evidence, and competency summary", () => {
    render(<SkillPortfolioCard skill={baseSkill} onOverrideSaved={vi.fn()} />);

    expect(screen.getByText("Communication")).toBeInTheDocument();
    expect(screen.getByText("L3")).toBeInTheDocument();
    expect(screen.getByText(/explained the tradeoffs clearly/i)).toBeInTheDocument();
    expect(screen.getByText(/communicates clearly under pressure/i)).toBeInTheDocument();
  });

  it("shows a 'Discovered' badge for a discovered skill", () => {
    render(
      <SkillPortfolioCard skill={{ ...baseSkill, is_discovered: true }} onOverrideSaved={vi.fn()} />
    );

    expect(screen.getByText(/discovered/i)).toBeInTheDocument();
  });

  it("shows the low-confidence note only when confidence is low", () => {
    const { rerender } = render(
      <SkillPortfolioCard skill={{ ...baseSkill, ai_confidence: "low" }} onOverrideSaved={vi.fn()} />
    );
    expect(screen.getByText(/only briefly explored/i)).toBeInTheDocument();

    rerender(<SkillPortfolioCard skill={baseSkill} onOverrideSaved={vi.fn()} />);
    expect(screen.queryByText(/only briefly explored/i)).not.toBeInTheDocument();
  });

  it("shows the overridden level instead of the AI level when an override exists", () => {
    const override: AssessorOverride = {
      id: 5,
      portfolio_skill_id: 1,
      ai_level: 3,
      override_level: 5,
      assessor_notes: "",
    };

    render(<SkillPortfolioCard skill={baseSkill} override={override} onOverrideSaved={vi.fn()} />);

    // Effective level badge shows L5 (the override), plus the AI->override chip inside OverridePanel.
    expect(screen.getAllByText("L5").length).toBeGreaterThan(0);
  });
});
