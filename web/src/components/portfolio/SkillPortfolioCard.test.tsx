import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import SkillPortfolioCard from "./SkillPortfolioCard";
import type { PortfolioSkill } from "@/types";

const baseSkill: PortfolioSkill = {
  id: 1,
  skill_label: "React / Frontend Development",
  is_discovered: false,
  status: "rated",
  ai_level: "3",
  ai_confidence: "high",
  evidence: ["Quote one."],
  competency_summary: "A solid summary.",
};

describe("SkillPortfolioCard", () => {
  it("renders a rated skill with its level and confidence", () => {
    render(<SkillPortfolioCard skill={baseSkill} onOverrideSaved={vi.fn()} />);
    expect(screen.getByText("React / Frontend Development")).toBeInTheDocument();
    expect(screen.getByText("A solid summary.")).toBeInTheDocument();
  });

  it("renders a not_assessed skill without a level badge or evidence", () => {
    const skill: PortfolioSkill = {
      ...baseSkill,
      status: "not_assessed",
      ai_level: null,
      ai_confidence: null,
      evidence: [],
      competency_summary: null,
    };
    render(<SkillPortfolioCard skill={skill} onOverrideSaved={vi.fn()} />);

    expect(screen.getByText("React / Frontend Development")).toBeInTheDocument();
    expect(screen.getByText(/not assessed/i)).toBeInTheDocument();
    expect(screen.queryByText("L3")).not.toBeInTheDocument();
  });
});
