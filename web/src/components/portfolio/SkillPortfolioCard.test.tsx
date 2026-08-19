import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SkillPortfolioCard from "./SkillPortfolioCard";
import type { PortfolioSkill } from "@/types";

const baseSkill: PortfolioSkill = {
  id: 1,
  skill_id: "sk-1",
  skill_label: "React",
  is_discovered: false,
  is_assessed: true,
  ai_level: 3,
  ai_confidence: "high",
  evidence: ["Explained reconciliation clearly."],
  competency_summary: "Solid grasp of the fundamentals.",
};

describe("SkillPortfolioCard", () => {
  it("renders the AI level and evidence for an assessed skill", () => {
    render(<SkillPortfolioCard skill={baseSkill} onOverrideSaved={vi.fn()} />);

    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("L3")).toBeInTheDocument();
    expect(screen.getByText(/Explained reconciliation clearly/)).toBeInTheDocument();
  });

  it("renders a 'not assessed' placeholder instead of a level badge when Gemini never rated the skill", () => {
    const missingSkill: PortfolioSkill = {
      ...baseSkill,
      id: null,
      is_assessed: false,
      ai_level: null,
      ai_confidence: null,
      evidence: [],
      competency_summary: null,
    };

    render(<SkillPortfolioCard skill={missingSkill} onOverrideSaved={vi.fn()} />);

    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText(/Not assessed/)).toBeInTheDocument();
    expect(screen.queryByText("L3")).not.toBeInTheDocument();
    expect(screen.queryByText("Override rating ▼")).not.toBeInTheDocument();
  });
});
