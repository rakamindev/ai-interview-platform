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

  it("renders discovered skill badge", () => {
    const discoveredSkill = { ...baseSkill, is_discovered: true };
    render(<SkillPortfolioCard skill={discoveredSkill} onOverrideSaved={vi.fn()} />);
    expect(screen.getByText(/Discovered/i)).toBeInTheDocument();
  });

  it("renders low confidence warning", () => {
    const lowConfidenceSkill = { ...baseSkill, ai_confidence: "low" };
    render(<SkillPortfolioCard skill={lowConfidenceSkill} onOverrideSaved={vi.fn()} />);
    expect(screen.getByText(/Only briefly explored/i)).toBeInTheDocument();
  });

  it("hides low confidence warning if skill is unassessed", () => {
    const unassessedLowConf = { ...baseSkill, ai_level: null as any, ai_confidence: "low" };
    render(<SkillPortfolioCard skill={unassessedLowConf} onOverrideSaved={vi.fn()} />);
    // The warning for unassessed skill should take precedence, and low confidence shouldn't show twice
    expect(screen.queryByText(/Only briefly explored/i)).not.toBeInTheDocument();
  });

  it("hides evidence section if evidence is empty", () => {
    const noEvidenceSkill = { ...baseSkill, evidence: [] };
    render(<SkillPortfolioCard skill={noEvidenceSkill} onOverrideSaved={vi.fn()} />);
    expect(screen.queryByText(/Evidence from interview/i)).not.toBeInTheDocument();
  });

  it("hides competency summary if empty", () => {
    const noSummarySkill = { ...baseSkill, competency_summary: "" };
    render(<SkillPortfolioCard skill={noSummarySkill} onOverrideSaved={vi.fn()} />);
    expect(screen.queryByText(/Competency summary/i)).not.toBeInTheDocument();
  });

  it("displays override panel when override is provided", () => {
    const override = {
      id: 1,
      portfolio_skill_id: 1,
      override_level: 5,
      assessor_notes: "Actually very good",
      created_at: "2026-08-18",
    };
    render(<SkillPortfolioCard skill={baseSkill} override={override} onOverrideSaved={vi.fn()} />);
    expect(screen.getByText(/You Overridden/i)).toBeInTheDocument();
    // The effective level badge should now be L5 (one in the main header, one inside the override panel)
    expect(screen.getAllByText("L5").length).toBe(2);
  });
});
