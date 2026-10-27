import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SkillPortfolioCard from "../components/portfolio/SkillPortfolioCard";
import type { PortfolioSkill, AssessorOverride } from "@/types";

describe("SkillPortfolioCard", () => {
  const baseSkill: PortfolioSkill = {
    id: 1,
    skill_label: "PostgreSQL Architecture",
    is_discovered: false,
    ai_level: "L3",
    ai_confidence: "high",
    evidence: ["Explained MVCC and WAL archiving in detail."],
    competency_summary: "Demonstrates strong understanding of relational internals.",
  };

  it("renders AI assessed level and evidence verbatim", () => {
    render(
      <SkillPortfolioCard
        skill={baseSkill}
        onOverrideSaved={vi.fn()}
      />
    );

    expect(screen.getByText("PostgreSQL Architecture")).toBeInTheDocument();
    expect(screen.getByText("L3")).toBeInTheDocument();
    expect(
      screen.getByText('• "Explained MVCC and WAL archiving in detail."')
    ).toBeInTheDocument();
    expect(
      screen.getByText("Demonstrates strong understanding of relational internals.")
    ).toBeInTheDocument();
  });

  it("prioritizes assessor override level over AI level", () => {
    const override: AssessorOverride = {
      id: 10,
      portfolio_skill_id: 1,
      ai_level: 3,
      override_level: 4,
      assessor_notes: "Candidate demonstrated staff-level partition pruning expertise.",
    };

    render(
      <SkillPortfolioCard
        skill={baseSkill}
        override={override}
        onOverrideSaved={vi.fn()}
      />
    );

    // Override level L4 should be displayed and marked as overridden
    const l4Elements = screen.getAllByText("L4");
    expect(l4Elements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/You Overridden ✓/i)).toBeInTheDocument();
  });

  it("displays discovered badge when skill was discovered during interview", () => {
    const discoveredSkill: PortfolioSkill = {
      ...baseSkill,
      is_discovered: true,
      skill_label: "Redis Caching Patterns",
    };

    render(
      <SkillPortfolioCard
        skill={discoveredSkill}
        onOverrideSaved={vi.fn()}
      />
    );

    expect(screen.getByText(/Discovered/i)).toBeInTheDocument();
  });

  it("renders warning banner when AI confidence is low", () => {
    const lowConfSkill: PortfolioSkill = {
      ...baseSkill,
      ai_confidence: "low",
    };

    render(
      <SkillPortfolioCard
        skill={lowConfSkill}
        onOverrideSaved={vi.fn()}
      />
    );

    expect(
      screen.getByText(/Only briefly explored\. Confidence is low/i)
    ).toBeInTheDocument();
  });
});
