import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import SkillPortfolioCard from "../SkillPortfolioCard";
import type { PortfolioSkill } from "@/types";

describe("SkillPortfolioCard Component", () => {
  const baseSkill: PortfolioSkill = {
    id: 1,
    skill_label: "GraphQL API",
    is_discovered: false,
    ai_level: "L3",
    ai_confidence: "high",
    evidence: ["Built GraphQL mutations for mobile clients"],
    competency_summary: "Strong candidate competency in GraphQL schema design.",
  };

  it("renders normal card without manual review badge when confidence is high", () => {
    render(<SkillPortfolioCard skill={baseSkill} onOverrideSaved={vi.fn()} />);

    expect(screen.getByText("GraphQL API")).toBeInTheDocument();
    expect(screen.queryByTestId("manual-review-badge")).not.toBeInTheDocument();
  });

  it("renders amber manual review badge when confidence is low", () => {
    const lowConfidenceSkill: PortfolioSkill = {
      ...baseSkill,
      ai_confidence: "low",
    };

    render(<SkillPortfolioCard skill={lowConfidenceSkill} onOverrideSaved={vi.fn()} />);

    expect(screen.getByTestId("manual-review-badge")).toBeInTheDocument();
    expect(screen.getByText("Perlu Review Asesor Manual")).toBeInTheDocument();
    expect(screen.getByTestId("manual-review-notice")).toBeInTheDocument();
  });

  it("renders amber manual review badge when skill is unassessed", () => {
    const unassessedSkill: PortfolioSkill = {
      ...baseSkill,
      ai_level: "0",
      ai_confidence: "unassessed",
    };

    render(<SkillPortfolioCard skill={unassessedSkill} onOverrideSaved={vi.fn()} />);

    expect(screen.getByTestId("manual-review-badge")).toBeInTheDocument();
    expect(screen.getByText("Perlu Review Asesor Manual")).toBeInTheDocument();
  });
});
