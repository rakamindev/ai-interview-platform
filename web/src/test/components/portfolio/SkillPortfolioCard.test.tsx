import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import type { PortfolioSkill, AssessorOverride } from "@/types";

function skill(overrides: Partial<PortfolioSkill> = {}): PortfolioSkill {
  return {
    id: 1,
    skill_label: "React",
    is_discovered: false,
    ai_level: 3,
    ai_confidence: "high",
    evidence: [],
    competency_summary: "",
    ...overrides,
  };
}

function override(overrides: Partial<AssessorOverride> = {}): AssessorOverride {
  return {
    id: 1,
    portfolio_skill_id: 1,
    ai_level: 3,
    override_level: 5,
    assessor_notes: "",
    ...overrides,
  };
}

describe("SkillPortfolioCard", () => {
  it("shows the ai_level badge when there is no override", () => {
    render(<SkillPortfolioCard skill={skill({ ai_level: 3 })} onOverrideSaved={vi.fn()} />);

    expect(screen.getByText("L3")).toBeInTheDocument();
  });

  it("shows the override level instead of ai_level when an override exists", () => {
    render(
      <SkillPortfolioCard
        skill={skill({ ai_level: 2 })}
        override={override({ override_level: 5 })}
        onOverrideSaved={vi.fn()}
      />
    );

    expect(screen.getAllByText("L5").length).toBeGreaterThan(0);
  });

  it("shows the low-confidence note only when confidence is low", () => {
    const { rerender } = render(
      <SkillPortfolioCard skill={skill({ ai_confidence: "low" })} onOverrideSaved={vi.fn()} />
    );
    expect(screen.getByText(/warrants a dedicated session/)).toBeInTheDocument();

    rerender(<SkillPortfolioCard skill={skill({ ai_confidence: "high" })} onOverrideSaved={vi.fn()} />);
    expect(screen.queryByText(/warrants a dedicated session/)).not.toBeInTheDocument();
  });

  it("shows the Discovered badge only when the skill was AI-discovered", () => {
    const { rerender } = render(
      <SkillPortfolioCard skill={skill({ is_discovered: true })} onOverrideSaved={vi.fn()} />
    );
    expect(screen.getByText("Discovered")).toBeInTheDocument();

    rerender(<SkillPortfolioCard skill={skill({ is_discovered: false })} onOverrideSaved={vi.fn()} />);
    expect(screen.queryByText("Discovered")).not.toBeInTheDocument();
  });

  it("renders the evidence quotes only when present", () => {
    const { rerender } = render(
      <SkillPortfolioCard skill={skill({ evidence: ["I built a component library."] })} onOverrideSaved={vi.fn()} />
    );
    expect(screen.getByText(/I built a component library/)).toBeInTheDocument();

    rerender(<SkillPortfolioCard skill={skill({ evidence: [] })} onOverrideSaved={vi.fn()} />);
    expect(screen.queryByText("Evidence from interview")).not.toBeInTheDocument();
  });

  it("renders the competency summary only when present", () => {
    const { rerender } = render(
      <SkillPortfolioCard skill={skill({ competency_summary: "Strong grasp of hooks." })} onOverrideSaved={vi.fn()} />
    );
    expect(screen.getByText("Strong grasp of hooks.")).toBeInTheDocument();

    rerender(<SkillPortfolioCard skill={skill({ competency_summary: "" })} onOverrideSaved={vi.fn()} />);
    expect(screen.queryByText("Competency summary")).not.toBeInTheDocument();
  });

  it("hides the override control when readOnly, but still shows the level badge", () => {
    render(<SkillPortfolioCard skill={skill({ ai_level: 4 })} readOnly />);

    expect(screen.getByText("L4")).toBeInTheDocument();
    expect(screen.queryByText("Override rating ▼")).not.toBeInTheDocument();
  });

  it("shows the override control when not readOnly and onOverrideSaved is provided", () => {
    render(<SkillPortfolioCard skill={skill()} onOverrideSaved={vi.fn()} />);

    expect(screen.getByText("Override rating ▼")).toBeInTheDocument();
  });
});
