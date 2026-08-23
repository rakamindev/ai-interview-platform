import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import SkillPortfolioCard from "./SkillPortfolioCard";
import type { PortfolioSkill, AssessorOverride } from "@/types";

vi.mock("@/services/portfolios", () => ({
  portfoliosApi: {
    getOverride: vi.fn(),
    getOverrideHistory: vi.fn(() => Promise.resolve({ data: { override_events: [] } }))
  }
}));

function makeSkill(overrides: Partial<PortfolioSkill> = {}): PortfolioSkill {
  return {
    id: 1,
    skill_id: "react",
    skill_label: "React",
    is_discovered: false,
    ai_level: 3,
    ai_confidence: "high",
    evidence: ["Built a component library"],
    competency_summary: "Strong React fundamentals",
    ...overrides
  };
}

const noopOverrideSaved = () => {};

describe("SkillPortfolioCard", () => {
  it("renders skill label and level badge", () => {
    render(<SkillPortfolioCard skill={makeSkill()} onOverrideSaved={noopOverrideSaved} />);
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("L3")).toBeInTheDocument();
  });

  // AC-2.5 — Evidence-first hierarchy
  it("renders evidence section before competency summary in DOM order", () => {
    const { container } = render(
      <SkillPortfolioCard
        skill={makeSkill({
          evidence: ["Quote A", "Quote B"],
          competency_summary: "Summary text"
        })}
        onOverrideSaved={noopOverrideSaved}
      />
    );
    const evidenceHeading = screen.getByText("Evidence from interview");
    const summaryHeading = screen.getByText("Competency summary");
    const allNodes = Array.from(container.querySelectorAll("*"));
    const evidenceIndex = allNodes.indexOf(evidenceHeading);
    const summaryIndex = allNodes.indexOf(summaryHeading);
    expect(evidenceIndex).toBeLessThan(summaryIndex);
  });

  it("clamps long evidence quotes with line-clamp", () => {
    render(
      <SkillPortfolioCard
        skill={makeSkill({ evidence: ["Very long quote that should be clamped"] })}
        onOverrideSaved={noopOverrideSaved}
      />
    );
    const quote = screen.getByText(/Very long quote/);
    expect(quote.className).toContain("line-clamp-3");
  });

  it("clamps long competency summaries with line-clamp", () => {
    render(
      <SkillPortfolioCard
        skill={makeSkill({ competency_summary: "Long summary text" })}
        onOverrideSaved={noopOverrideSaved}
      />
    );
    const summary = screen.getByText("Long summary text");
    expect(summary.className).toContain("line-clamp-4");
  });

  it("shows discovered badge when is_discovered is true", () => {
    render(
      <SkillPortfolioCard
        skill={makeSkill({ is_discovered: true })}
        onOverrideSaved={noopOverrideSaved}
      />
    );
    expect(screen.getByText("Discovered")).toBeInTheDocument();
  });

  it("falls back to L1 when parseLevel returns 0 (garbage ai_level)", () => {
    // parseLevel("garbage") returns 0; effectiveLevel should be 1
    render(
      <SkillPortfolioCard
        skill={makeSkill({ ai_level: "garbage" as any })}
        onOverrideSaved={noopOverrideSaved}
      />
    );
    expect(screen.getByText("L1")).toBeInTheDocument();
  });

  it("uses override_level when override is provided", () => {
    const override: AssessorOverride = {
      id: 10,
      portfolio_skill_id: 1,
      ai_level: 3,
      override_level: 5,
      assessor_notes: ""
    };
    render(
      <SkillPortfolioCard
        skill={makeSkill()}
        override={override}
        onOverrideSaved={noopOverrideSaved}
      />
    );
    // L5 appears in SkillPortfolioCard's LevelBadge; the second (AI→override)
    // is inside OverridePanel's dialog, which only mounts once opened.
    fireEvent.click(screen.getByRole("button", { name: /override applied/i }));
    const l5Elements = screen.getAllByText("L5");
    expect(l5Elements.length).toBeGreaterThanOrEqual(2);
  });
});
