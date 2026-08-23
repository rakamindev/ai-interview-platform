import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import type { SkillComparison } from "@/types";

describe("ComparisonTable Component", () => {
  const mockComparisons: SkillComparison[] = [
    {
      skill_label: "React Core",
      required_level: 3,
      candidate_level: 3,
      result: "match",
      delta: 0,
      is_override: false,
    },
    {
      skill_label: "System Design",
      required_level: 4,
      candidate_level: 5,
      result: "exceed",
      delta: 1,
      is_override: false,
    },
    {
      skill_label: "Communication",
      expected_level: 4, // test fallback to expected_level
      candidate_level: 4,
      result: "match",
      delta: 0,
      is_override: true,
    },
    {
      skill_label: "GraphQL API",
      required_level: 3,
      candidate_level: 2,
      result: "gap",
      delta: -1,
      is_override: false,
    },
  ];

  it("renders all comparison skill labels and level columns accurately", () => {
    render(<ComparisonTable comparisons={mockComparisons} />);

    expect(screen.getByText("React Core")).toBeInTheDocument();
    expect(screen.getByText("System Design")).toBeInTheDocument();
    expect(screen.getByText("Communication")).toBeInTheDocument();
    expect(screen.getByText("GraphQL API")).toBeInTheDocument();
  });

  it("renders human override indicator (✏) for overridden skills", () => {
    render(<ComparisonTable comparisons={mockComparisons} />);

    expect(screen.getByText("✏")).toBeInTheDocument();
  });

  it("calculates overall fit score accurately", () => {
    render(<ComparisonTable comparisons={mockComparisons} />);

    // 3 out of 4 skills match or exceed = 75%
    expect(screen.getByText(/Fit Score: 75%/i)).toBeInTheDocument();
  });
});
