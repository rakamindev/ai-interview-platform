import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SkillPortfolioCard from "./SkillPortfolioCard";
import type { PortfolioSkill } from "@/types";

describe("SkillPortfolioCard", () => {
  const baseSkill: PortfolioSkill = {
    id: 1,
    skill_label: "React / Frontend Development",
    is_discovered: false,
    ai_level: "L3",
    ai_confidence: "high",
    evidence: ["I used custom hooks to encapsulate WebSocket subscription logic."],
    competency_summary: "Strong proficiency in modern React patterns.",
  };

  it("renders assessed skill with correct level badge and evidence", () => {
    render(<SkillPortfolioCard skill={baseSkill} onOverrideSaved={vi.fn()} />);

    expect(screen.getByText("React / Frontend Development")).toBeInTheDocument();
    expect(screen.getByText("L3")).toBeInTheDocument();
    expect(
      screen.getByText('• "I used custom hooks to encapsulate WebSocket subscription logic."')
    ).toBeInTheDocument();
    expect(screen.getByText("Strong proficiency in modern React patterns.")).toBeInTheDocument();
  });

  it("renders unassessed skill gracefully without falling back to L1", () => {
    const unassessedSkill: PortfolioSkill = {
      id: 2,
      skill_label: "System Design",
      is_discovered: false,
      ai_level: null,
      ai_confidence: "low",
      evidence: [],
      competency_summary: "Skill was not assessed during this session.",
    };

    render(<SkillPortfolioCard skill={unassessedSkill} onOverrideSaved={vi.fn()} />);

    expect(screen.getByText("System Design")).toBeInTheDocument();
    expect(screen.getByTestId("unassessed-badge")).toBeInTheDocument();
    expect(screen.queryByText("L1")).not.toBeInTheDocument();
  });
});
