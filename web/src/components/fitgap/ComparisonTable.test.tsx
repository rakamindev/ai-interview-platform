import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ComparisonTable from "./ComparisonTable";
import type { SkillComparison } from "@/types";

describe("ComparisonTable", () => {
  const mockComparisons: SkillComparison[] = [
    {
      skill_id: 1,
      skill_label: "Ruby on Rails Architecture",
      required_level: 4,
      candidate_level: 4,
      result: "match",
      delta: 0,
      is_override: false,
    },
    {
      skill_id: 2,
      skill_label: "System Design & Distributed Scalability",
      required_level: 5,
      candidate_level: 3,
      result: "gap",
      delta: -2,
      is_override: true,
    },
  ];

  it("renders benchmark required_level accurately under DEF-P1-01", () => {
    render(<ComparisonTable comparisons={mockComparisons} />);

    // Required column for Rails displays L4 and System Design displays L5
    expect(screen.getAllByText("L4").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("L5")).toBeInTheDocument();
  });

  it("renders human override flag (✏) when is_override is true under DEF-P1-02", () => {
    render(<ComparisonTable comparisons={mockComparisons} />);

    // System Design has is_override: true
    const overridePencil = screen.getByTitle("Human override applied");
    expect(overridePencil).toBeInTheDocument();
    expect(overridePencil.textContent).toBe("✏");
  });

  it("does not render override flag when is_override is false", () => {
    const aiOnlyComparisons: SkillComparison[] = [
      {
        skill_id: 3,
        skill_label: "PostgreSQL Tuning",
        required_level: 3,
        candidate_level: 3,
        result: "match",
        delta: 0,
        is_override: false,
      },
    ];

    render(<ComparisonTable comparisons={aiOnlyComparisons} />);
    expect(screen.queryByTitle("Human override applied")).not.toBeInTheDocument();
  });
});
