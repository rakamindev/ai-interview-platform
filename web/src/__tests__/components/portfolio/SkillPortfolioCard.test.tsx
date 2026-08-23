import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import type { PortfolioSkill } from "@/types";

describe("SkillPortfolioCard", () => {
  const baseSkill: PortfolioSkill = {
    id: 1,
    skill_label: "Node.js",
    is_discovered: false,
    ai_level: 3,
    ai_confidence: "high",
    evidence: ["Quote 1"],
    competency_summary: "Solid skills",
    expected_level: 4,
  };

  it("renders expected level badge when present", () => {
    render(<SkillPortfolioCard skill={baseSkill} onOverrideSaved={vi.fn()} />);
    expect(screen.getByText("Expected")).toBeInTheDocument();
    expect(screen.getByText("Node.js")).toBeInTheDocument();
  });
});
