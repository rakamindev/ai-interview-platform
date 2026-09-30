import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import type { PortfolioSkill } from "@/types";

const baseSkill = (overrides: Partial<PortfolioSkill> = {}): PortfolioSkill => ({
  id: 1,
  skill_label: "React / Frontend Development Core",
  is_discovered: false,
  ai_level: 3,
  ai_confidence: "high",
  evidence: ['"I built a real-time dashboard."'],
  competency_summary: "Strong L3.",
  ...overrides,
});

describe("SkillPortfolioCard", () => {
  it("renders a normal assessed skill with its level", () => {
    render(
      <SkillPortfolioCard skill={baseSkill()} onOverrideSaved={() => {}} />
    );
    expect(screen.getByText("React / Frontend Development Core")).toBeInTheDocument();
    expect(screen.getByText("L3")).toBeInTheDocument();
    expect(screen.getByText(/Confidence: HIGH/)).toBeInTheDocument();
  });

  it("renders an unassessed skill honestly (no fabricated L1)", () => {
    render(
      <SkillPortfolioCard
        skill={baseSkill({ assessed: false, ai_level: null, ai_confidence: null, evidence: [] })}
        onOverrideSaved={() => {}}
      />
    );

    // The old bug: missing level → parseLevel fallback 1 → displayed "L1".
    expect(screen.queryByText("L1")).not.toBeInTheDocument();
    expect(screen.getByText("Not assessed this session")).toBeInTheDocument();
    // No override affordance for a skill that has no AI baseline.
    expect(screen.queryByText("Override rating ▼")).not.toBeInTheDocument();
  });

  it("shows a low-confidence notice for low-confidence skills", () => {
    render(
      <SkillPortfolioCard
        skill={baseSkill({ ai_level: 2, ai_confidence: "low" })}
        onOverrideSaved={() => {}}
      />
    );
    expect(screen.getByText(/Confidence is low/)).toBeInTheDocument();
  });
});