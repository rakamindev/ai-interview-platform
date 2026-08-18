import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import SkillPortfolioCard from "./SkillPortfolioCard";
import type { PortfolioSkill, AssessorOverride } from "@/types";

describe("SkillPortfolioCard", () => {
  const baseSkill: PortfolioSkill = {
    id: 1,
    skill_id: "SK-001",
    skill_label: "TypeScript / Architecture",
    is_discovered: false,
    ai_level: 3,
    ai_confidence: "high",
    evidence: ["Demonstrated solid architecture understanding."],
    competency_summary: "Consistently designs modular frontend components.",
  };

  it("renders numeric levels 1 through 5 with corresponding L-badge", () => {
    const { rerender } = render(
      <SkillPortfolioCard skill={baseSkill} onOverrideSaved={vi.fn()} />
    );
    expect(screen.getByText("L3")).toBeInTheDocument();
    expect(screen.getByText("Proficient")).toBeInTheDocument();

    rerender(
      <SkillPortfolioCard skill={{ ...baseSkill, ai_level: 5 }} onOverrideSaved={vi.fn()} />
    );
    expect(screen.getByText("L5")).toBeInTheDocument();
    expect(screen.getByText("Expert")).toBeInTheDocument();
  });

  it("renders high, medium, and low confidence indicators", () => {
    const { rerender } = render(
      <SkillPortfolioCard skill={baseSkill} onOverrideSaved={vi.fn()} />
    );
    expect(screen.getByText(/Confidence: HIGH/i)).toBeInTheDocument();

    rerender(
      <SkillPortfolioCard skill={{ ...baseSkill, ai_confidence: "low" }} onOverrideSaved={vi.fn()} />
    );
    expect(screen.getByText(/Confidence: LOW/i)).toBeInTheDocument();
    expect(screen.getByText(/Only briefly explored/i)).toBeInTheDocument();
  });

  it("renders long evidence quotes without breaking layout", () => {
    const longQuote = "A".repeat(800);
    render(
      <SkillPortfolioCard
        skill={{ ...baseSkill, evidence: [longQuote] }}
        onOverrideSaved={vi.fn()}
      />
    );
    expect(screen.getByText(`• "${longQuote}"`)).toBeInTheDocument();
  });

  it("displays assessor override badge and note when present", () => {
    const override: AssessorOverride = {
      id: 10,
      portfolio_skill_id: 1,
      ai_level: 3,
      override_level: 4,
      assessor_notes: "Demonstrated L4 leadership during calibration.",
    };

    render(
      <SkillPortfolioCard
        skill={baseSkill}
        override={override}
        onOverrideSaved={vi.fn()}
      />
    );

    expect(screen.getAllByText("L4").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Overridden by you")).toBeInTheDocument();
  });

  it("handles invalid runtime ai_level by rendering 'Rating unavailable' without L1 badge or override action", () => {
    const malformedSkill: PortfolioSkill = {
      ...baseSkill,
      ai_level: "invalid_level" as unknown as number,
    };

    render(
      <SkillPortfolioCard
        skill={malformedSkill}
        onOverrideSaved={vi.fn()}
      />
    );

    expect(screen.queryByText("L1")).not.toBeInTheDocument();
    expect(screen.getByText("Rating unavailable")).toBeInTheDocument();
    expect(screen.queryByText(/Override rating/i)).not.toBeInTheDocument();
  });

  it("renders 'Rating unavailable' and suppresses override actions even if an existing override is passed for invalid ai_level", () => {
    const malformedSkill: PortfolioSkill = {
      ...baseSkill,
      ai_level: null as unknown as number,
    };
    const existingOverride: AssessorOverride = {
      id: 11,
      portfolio_skill_id: 1,
      ai_level: 3,
      override_level: 4,
      assessor_notes: "Prior override note",
    };

    render(
      <SkillPortfolioCard
        skill={malformedSkill}
        override={existingOverride}
        onOverrideSaved={vi.fn()}
      />
    );

    expect(screen.getByText("Rating unavailable")).toBeInTheDocument();
    expect(screen.queryByText("L1")).not.toBeInTheDocument();
    expect(screen.queryByText("L4")).not.toBeInTheDocument();
    expect(screen.queryByText("Overridden by you")).not.toBeInTheDocument();
    expect(screen.queryByText(/Edit override/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Override rating/i)).not.toBeInTheDocument();
  });
});
