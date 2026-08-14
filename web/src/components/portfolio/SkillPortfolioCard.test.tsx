import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SkillPortfolioCard from "./SkillPortfolioCard";
import type { PortfolioSkill } from "@/types";

function makeSkill(overrides: Partial<PortfolioSkill> = {}): PortfolioSkill {
  return {
    id: 1,
    skill_id: 1,
    skill_label: "React",
    is_discovered: false,
    status: "assessed",
    ai_level: 3,
    ai_confidence: "high",
    evidence: [],
    competency_summary: "Solid understanding of component composition.",
    ...overrides,
  };
}

describe("SkillPortfolioCard", () => {
  it("renders a real level badge for an assessed skill", () => {
    render(<SkillPortfolioCard skill={makeSkill()} onOverrideSaved={vi.fn()} />);

    expect(screen.getByText("L3")).toBeInTheDocument();
    expect(screen.getByText("Confidence: HIGH")).toBeInTheDocument();
    expect(screen.getByText("Override rating ▼")).toBeInTheDocument();
  });

  // Regression: assessment/gap-analysis.md P0-4 — a configured skill the AI
  // never covered used to just vanish from the list. It must now render
  // explicitly, and must never show a numeric level (that would look like a
  // real, low score for a skill that was never actually probed).
  it("renders an explicit not_assessed state instead of disappearing or showing a fake score", () => {
    const skill = makeSkill({
      status: "not_assessed",
      ai_level: null,
      ai_confidence: null,
      competency_summary: "This skill was configured for the assessment but was not covered.",
    });

    render(<SkillPortfolioCard skill={skill} onOverrideSaved={vi.fn()} />);

    expect(screen.getByText("Not assessed")).toBeInTheDocument();
    expect(screen.queryByText(/^L[1-5]$/)).not.toBeInTheDocument();
    expect(screen.queryByText("Override rating ▼")).not.toBeInTheDocument();
  });

  it("renders an explicit unparseable state distinct from not_assessed", () => {
    const skill = makeSkill({
      status: "unparseable",
      ai_level: null,
      ai_confidence: null,
      competency_summary: "Needs manual review.",
    });

    render(<SkillPortfolioCard skill={skill} onOverrideSaved={vi.fn()} />);

    expect(screen.getByText("Needs manual review")).toBeInTheDocument();
    expect(screen.queryByText("Not assessed")).not.toBeInTheDocument();
    expect(screen.queryByText(/^L[1-5]$/)).not.toBeInTheDocument();
  });

  // Regression: the old parseLevel() did `level.replace(...)` directly and
  // would throw on null/undefined. A skill marked "assessed" with a missing
  // level must degrade to the review state, not crash the whole page.
  it("does not crash when status is assessed but ai_level is null", () => {
    const skill = makeSkill({ status: "assessed", ai_level: null });

    expect(() =>
      render(<SkillPortfolioCard skill={skill} onOverrideSaved={vi.fn()} />)
    ).not.toThrow();
    expect(screen.getByText("Needs manual review")).toBeInTheDocument();
  });

  it("shows the discovered badge for a discovered skill regardless of status", () => {
    const skill = makeSkill({ is_discovered: true, status: "not_assessed", ai_level: null, ai_confidence: null });

    render(<SkillPortfolioCard skill={skill} onOverrideSaved={vi.fn()} />);

    expect(screen.getByText("Discovered")).toBeInTheDocument();
  });
});
