import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import SkillPortfolioCard from "../SkillPortfolioCard";
import type { PortfolioSkill } from "@/types";

describe("SkillPortfolioCard", () => {
  const baseSkill: PortfolioSkill = {
    id: 1,
    skill_label: "React",
    is_discovered: false,
    ai_level: "3",
    ai_confidence: "high",
    evidence: ["Quote 1"],
    competency_summary: "Good at React",
  };

  it("renders a standard skill with L3 badge", () => {
    render(<SkillPortfolioCard skill={baseSkill} onOverrideSaved={vi.fn()} />);
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("L3")).toBeInTheDocument();
    expect(screen.getByText("Confidence: HIGH")).toBeInTheDocument();
  });

  it("renders an unassessed skill with N/A badge and warning note", () => {
    // ai_level string 'null' or literally null as any
    const unassessedSkill = { ...baseSkill, ai_level: null as any };
    render(<SkillPortfolioCard skill={unassessedSkill} onOverrideSaved={vi.fn()} />);
    
    expect(screen.getByText("N/A")).toBeInTheDocument();
    expect(screen.getByText("Unassessed")).toBeInTheDocument();
    expect(screen.getByText(/This skill was configured for assessment but never evaluated/i)).toBeInTheDocument();
    expect(screen.getByText("Confidence: N/A")).toBeInTheDocument();
  });

  it("truncates long evidence lists and allows expansion", () => {
    const skillWithManyQuotes = {
      ...baseSkill,
      evidence: ["Q1", "Q2", "Q3", "Q4", "Q5"],
    };
    
    render(<SkillPortfolioCard skill={skillWithManyQuotes} onOverrideSaved={vi.fn()} />);
    
    // Initially shows only 3
    expect(screen.getByText('• "Q1"')).toBeInTheDocument();
    expect(screen.getByText('• "Q3"')).toBeInTheDocument();
    expect(screen.queryByText('• "Q4"')).not.toBeInTheDocument();
    
    // Toggle
    const toggleBtn = screen.getByText("Show 2 more");
    fireEvent.click(toggleBtn);
    
    expect(screen.getByText('• "Q4"')).toBeInTheDocument();
    expect(screen.getByText("Show less")).toBeInTheDocument();
  });

  it("truncates long competency summary texts", () => {
    const longText = "A".repeat(250);
    const skillWithLongSummary = { ...baseSkill, competency_summary: longText };
    
    const { container } = render(<SkillPortfolioCard skill={skillWithLongSummary} onOverrideSaved={vi.fn()} />);
    
    // Has line-clamp class
    expect(container.querySelector(".line-clamp-3")).toBeInTheDocument();
    
    // Toggle
    fireEvent.click(screen.getByText("Show more"));
    expect(container.querySelector(".line-clamp-3")).not.toBeInTheDocument();
    expect(screen.getByText("Show less")).toBeInTheDocument();
  });
});
