import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import SkillPortfolioCard from "./SkillPortfolioCard";
import type { PortfolioSkill, AssessorOverride } from "@/types";

describe("SkillPortfolioCard", () => {
  const onOverrideSaved = vi.fn();

  const assessedSkill: PortfolioSkill = {
    id: 101,
    skill_label: "Distributed Systems",
    is_discovered: false,
    is_assessed: true,
    ai_level: "L4",
    ai_confidence: "high",
    expected_level: 4,
    evidence: [
      "I designed an idempotency layer using Redis and PostgreSQL advisory locks.",
    ],
    competency_summary:
      "Demonstrates solid grasp of distributed consensus and fault-tolerance patterns.",
  };

  const unassessedSkill: PortfolioSkill = {
    id: 102,
    skill_label: "GraphQL Federation",
    is_discovered: false,
    is_assessed: false,
    ai_level: null,
    ai_confidence: "low",
    expected_level: 3,
    evidence: [],
    competency_summary: null,
  };

  it("renders assessed skill details, target level, confidence, and quotes", () => {
    render(
      <SkillPortfolioCard
        skill={assessedSkill}
        onOverrideSaved={onOverrideSaved}
      />
    );

    expect(screen.getByText("Distributed Systems")).toBeInTheDocument();
    expect(screen.getByText(/Target: L4/)).toBeInTheDocument();
    expect(screen.getByText(/Confidence: HIGH/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        '"I designed an idempotency layer using Redis and PostgreSQL advisory locks."'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Demonstrates solid grasp of distributed consensus and fault-tolerance patterns."
      )
    ).toBeInTheDocument();
  });

  it("renders unassessed skill clearly with 'Not Assessed' and explanation", () => {
    render(
      <SkillPortfolioCard
        skill={unassessedSkill}
        onOverrideSaved={onOverrideSaved}
      />
    );

    expect(screen.getByText("GraphQL Federation")).toBeInTheDocument();
    expect(screen.getAllByText("Not Assessed").length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        "This skill was included in the assessment criteria, but was not actively probed or evaluated during the interview dialogue."
      )
    ).toBeInTheDocument();
  });

  it("renders human assessor override banner and notes when override is present", () => {
    const override: AssessorOverride = {
      id: 55,
      portfolio_skill_id: 101,
      ai_level: 4,
      override_level: 5,
      assessor_notes: "Promoted to Staff (L5) based on real-world portfolio architecture artifact.",
    };

    render(
      <SkillPortfolioCard
        skill={assessedSkill}
        override={override}
        onOverrideSaved={onOverrideSaved}
      />
    );

    expect(screen.getByText(/Assessor Override Applied/)).toBeInTheDocument();
    expect(
      screen.getByText(
        '"Promoted to Staff (L5) based on real-world portfolio architecture artifact."'
      )
    ).toBeInTheDocument();
  });
});
