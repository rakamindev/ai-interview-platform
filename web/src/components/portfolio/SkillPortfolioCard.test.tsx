import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import SkillPortfolioCard from "./SkillPortfolioCard";
import type { PortfolioSkill, AssessorOverride } from "@/types";

describe("SkillPortfolioCard Component", () => {
  const baseSkill: PortfolioSkill = {
    id: 1,
    skill_label: "PostgreSQL & Query Optimization",
    ai_level: "L3",
    ai_confidence: "high",
    is_discovered: false,
    evidence: ["Explained EXPLAIN ANALYZE on slow b-tree scans"],
    competency_summary: "Strong query profiling and index design capability.",
  };

  it("renders skill label, AI level badge, and competency summary", () => {
    const handleOverrideSaved = vi.fn();
    render(<SkillPortfolioCard skill={baseSkill} onOverrideSaved={handleOverrideSaved} />);

    expect(screen.getByText("PostgreSQL & Query Optimization")).toBeInTheDocument();
    expect(screen.getByText("L3")).toBeInTheDocument();
    expect(screen.getByText("Strong query profiling and index design capability.")).toBeInTheDocument();
    expect(screen.getByText(/Explained EXPLAIN ANALYZE/)).toBeInTheDocument();
  });

  it("renders human override level when an override is present", () => {
    const override: AssessorOverride = {
      id: 5,
      portfolio_skill_id: 1,
      ai_level: 3,
      override_level: 4,
      assessor_notes: "Demonstrated advanced partitioning and replication skills.",
    };

    const handleOverrideSaved = vi.fn();
    render(
      <SkillPortfolioCard
        skill={baseSkill}
        override={override}
        onOverrideSaved={handleOverrideSaved}
      />
    );

    // Overridden effective level is L4 and shows in override badge
    expect(screen.getAllByText("L4").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("You Overridden ✓")).toBeInTheDocument();
  });

  it("shows discovered badge for spontaneous skills", () => {
    const discoveredSkill: PortfolioSkill = {
      ...baseSkill,
      is_discovered: true,
      skill_label: "Kubernetes Operator SDK",
    };

    const handleOverrideSaved = vi.fn();
    render(
      <SkillPortfolioCard
        skill={discoveredSkill}
        onOverrideSaved={handleOverrideSaved}
      />
    );

    expect(screen.getByText("Discovered")).toBeInTheDocument();
  });
});
