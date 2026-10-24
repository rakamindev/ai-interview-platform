import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ComparisonTable from "./ComparisonTable";
import type { SkillComparison } from "@/types";

describe("ComparisonTable", () => {
  const comparisons: SkillComparison[] = [
    {
      skill_id: 1,
      skill_label: "React Architecture",
      required_level: 3,
      candidate_level: 3,
      result: "match",
      delta: 0,
      is_override: false,
    },
    {
      skill_id: 2,
      skill_label: "Performance Profiling",
      required_level: 4,
      candidate_level: 2,
      result: "gap",
      delta: -2,
      is_override: false,
    },
    {
      skill_id: 3,
      skill_label: "Cloud Infrastructure",
      required_level: 3,
      candidate_level: null,
      result: "not_assessed",
      delta: null,
      is_override: false,
    },
  ];

  it("renders match, gap, and not_assessed skills with truthful indicators", () => {
    render(<ComparisonTable comparisons={comparisons} />);

    expect(screen.getByText("React Architecture")).toBeInTheDocument();
    expect(screen.getByText("Performance Profiling")).toBeInTheDocument();
    expect(screen.getByText("Cloud Infrastructure")).toBeInTheDocument();

    expect(screen.getAllByText(/Match/).length).toBe(2);
    expect(screen.getAllByText(/Gap/).length).toBe(2);
    expect(screen.getAllByText(/Not [Aa]ssessed/).length).toBe(2);

    // Summary counts
    expect(screen.getByText("✅ Match: 1 skill")).toBeInTheDocument();
    expect(screen.getByText("⚠ Gap: 1 skill")).toBeInTheDocument();
    expect(screen.getByText("⏸ Not Assessed: 1 skill")).toBeInTheDocument();
  });
});
