import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import SkillPortfolioCard from "./SkillPortfolioCard";
import type { PortfolioSkill, AssessorOverride } from "@/types";

describe("SkillPortfolioCard Component", () => {
  const mockSkill: PortfolioSkill = {
    id: 1,
    skill_id: "sk-react",
    skill_label: "React Architecture",
    is_discovered: false,
    ai_level: 3,
    ai_confidence: "high",
    evidence: [
      "I designed our state management layer using Jotai atoms.",
      "We built reusable component libraries across 3 teams.",
      "I optimized bundle performance by 35% with lazy loading."
    ],
    competency_summary: "Demonstrates deep mastery of modern React component patterns and state management.",
  };

  it("renders skill label, effective level, and confidence indicator", () => {
    render(<SkillPortfolioCard skill={mockSkill} onOverrideSaved={vi.fn()} />);

    expect(screen.getByText("React Architecture")).toBeInTheDocument();
    expect(screen.getAllByText("L3").length).toBeGreaterThan(0);
    expect(screen.getByText(/High/i)).toBeInTheDocument();
    expect(screen.getByText(/Demonstrates deep mastery/i)).toBeInTheDocument();
  });

  it("displays override level and notes when human override is present", () => {
    const mockOverride: AssessorOverride = {
      id: 10,
      portfolio_skill_id: 1,
      ai_level: 3,
      override_level: 4,
      assessor_notes: "Demonstrated senior architectural decision-making in turns 10-12.",
    };

    render(
      <SkillPortfolioCard
        skill={mockSkill}
        override={mockOverride}
        onOverrideSaved={vi.fn()}
      />
    );

    expect(screen.getAllByText("L4").length).toBeGreaterThan(0);
    expect(screen.getByText(/✏ AI: L3 → L4/i)).toBeInTheDocument();
    expect(screen.getByText(/Demonstrated senior architectural decision-making/i)).toBeInTheDocument();
  });

  it("allows expanding and collapsing verbatim quotes", () => {
    render(<SkillPortfolioCard skill={mockSkill} onOverrideSaved={vi.fn()} />);

    // Initially shows first 2 quotes
    expect(screen.getByText(/"I designed our state management layer/i)).toBeInTheDocument();
    expect(screen.getByText(/"We built reusable component libraries/i)).toBeInTheDocument();
    expect(screen.queryByText(/"I optimized bundle performance/i)).not.toBeInTheDocument();

    // Click "+1 more"
    const expandBtn = screen.getByText(/\+1 more/i);
    fireEvent.click(expandBtn);

    // 3rd quote now visible
    expect(screen.getByText(/"I optimized bundle performance/i)).toBeInTheDocument();

    // Click "Show less"
    const collapseBtn = screen.getByText(/Show less/i);
    fireEvent.click(collapseBtn);

    expect(screen.queryByText(/"I optimized bundle performance/i)).not.toBeInTheDocument();
  });
});
