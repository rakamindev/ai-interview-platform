import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SkillPortfolioCard from "../SkillPortfolioCard";
import type { PortfolioSkill, AssessorOverride } from "@/types";

describe("SkillPortfolioCard Component", () => {
  const baseSkill: PortfolioSkill = {
    id: 1,
    skill_label: "TypeScript / Frontend Rigor",
    ai_level: 3,
    ai_confidence: "high",
    is_discovered: false,
    evidence: [
      "Strict typing on all API response payloads",
      "Created generic type-safe event bus",
    ],
    competency_summary: "Demonstrates consistent L3 engineering rigor and type safety.",
  };

  it("renders skill details, level, and evidence correctly", () => {
    render(
      <SkillPortfolioCard
        skill={baseSkill}
        onOverrideSaved={vi.fn()}
      />
    );

    expect(screen.getByText("TypeScript / Frontend Rigor")).toBeInTheDocument();
    expect(screen.getByText("L3")).toBeInTheDocument();
    expect(screen.getByText("Proficient")).toBeInTheDocument();
    expect(screen.getByText(/Strict typing on all API response payloads/)).toBeInTheDocument();
    expect(screen.getByText(/Demonstrates consistent L3/)).toBeInTheDocument();
  });

  it("renders discovered skill badge when is_discovered is true", () => {
    const discoveredSkill: PortfolioSkill = {
      ...baseSkill,
      is_discovered: true,
      skill_label: "GraphQL Federation",
    };

    render(
      <SkillPortfolioCard
        skill={discoveredSkill}
        onOverrideSaved={vi.fn()}
      />
    );

    expect(screen.getByText("Discovered")).toBeInTheDocument();
  });

  it("displays assessor override badge and updates effective level", () => {
    const mockOverride: AssessorOverride = {
      id: 10,
      portfolio_skill_id: 1,
      ai_level: 3,
      override_level: 4,
      assessor_notes: "Demonstrates cross-team library adoption",
    };

    render(
      <SkillPortfolioCard
        skill={baseSkill}
        override={mockOverride}
        onOverrideSaved={vi.fn()}
      />
    );

    // Effective level should be L4
    expect(screen.getAllByText("L4").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Override \(AI: L3\)/)).toBeInTheDocument();
  });

  it("handles unassessed skill without forcing an erroneous L1 rating", () => {
    const unassessedSkill: PortfolioSkill = {
      ...baseSkill,
      ai_level: 0, // Unassessed
      ai_confidence: "low",
      evidence: [],
      competency_summary: "Skill was not covered during this interview session.",
    };

    render(
      <SkillPortfolioCard
        skill={unassessedSkill}
        onOverrideSaved={vi.fn()}
      />
    );

    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("Unassessed")).toBeInTheDocument();
    expect(screen.getByText("Not assessed")).toBeInTheDocument();
  });
});
