import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ComparisonTable from "../ComparisonTable";
import type { SkillComparison } from "@/types";

describe("ComparisonTable Component", () => {
  it("renders empty state gracefully when no comparisons are provided", () => {
    render(<ComparisonTable comparisons={[]} />);
    expect(screen.getByTestId("comparison-empty-state")).toBeInTheDocument();
    expect(screen.getByText("No Skill Comparisons Available")).toBeInTheDocument();
  });

  it("renders comparisons with expected_level (backend contract) and required_level fallbacks", () => {
    const mockComparisons: SkillComparison[] = [
      {
        skill_label: "React / Frontend Architecture",
        expected_level: 3, // Backend returned field
        candidate_level: 5,
        result: "exceed",
        delta: 2,
      },
      {
        skill_label: "System Design",
        required_level: 2, // Legacy frontend field
        candidate_level: 4,
        result: "exceed",
        delta: 2,
      },
    ];

    render(<ComparisonTable comparisons={mockComparisons} />);

    // Verify row 1 (backend expected_level: 3, candidate: 5)
    const row1 = screen.getByTestId("skill-row-react-/-frontend-architecture");
    expect(row1).toHaveTextContent("L3");
    expect(row1).toHaveTextContent("L5");
    expect(screen.getByTestId("result-badge-react-/-frontend-architecture")).toHaveTextContent("Exceeds +2");

    // Verify row 2 (legacy required_level: 2 and candidate: 4)
    const row2 = screen.getByTestId("skill-row-system-design");
    expect(row2).toHaveTextContent("L2");
    expect(row2).toHaveTextContent("L4");
    expect(screen.getByTestId("result-badge-system-design")).toHaveTextContent("Exceeds +2");
  });

  it("handles unassessed skills cleanly without throwing errors or displaying false 0/null", () => {
    const mockComparisons: SkillComparison[] = [
      {
        skill_label: "Distributed Caching",
        expected_level: 3,
        candidate_level: undefined,
        result: "not_assessed",
        delta: undefined,
      },
    ];

    render(<ComparisonTable comparisons={mockComparisons} />);

    expect(screen.getByText("Distributed Caching")).toBeInTheDocument();
    expect(screen.getAllByText("Not assessed")).toHaveLength(2);
    expect(screen.getByTestId("result-badge-distributed-caching")).toHaveTextContent("Not assessed");
    expect(screen.getByText(/Unassessed:/).parentElement).toHaveTextContent("1 skill");
  });

  it("displays assessor human override indicator when is_override is true", () => {
    const mockComparisons: SkillComparison[] = [
      {
        skill_label: "Team Leadership",
        expected_level: 3,
        candidate_level: 4,
        result: "exceed",
        delta: 1,
        is_override: true,
      },
    ];

    render(<ComparisonTable comparisons={mockComparisons} />);

    expect(screen.getByText(/Override/)).toBeInTheDocument();
  });

  it("computes all summary counts correctly across match, exceed, gap, and unassessed", () => {
    const mockComparisons: SkillComparison[] = [
      { skill_label: "S1", expected_level: 3, candidate_level: 3, result: "match", delta: 0 },
      { skill_label: "S2", expected_level: 2, candidate_level: 4, result: "exceed", delta: 2 },
      { skill_label: "S3", expected_level: 4, candidate_level: 2, result: "gap", delta: -2 },
      { skill_label: "S4", expected_level: 3, candidate_level: undefined, result: "not_assessed" },
    ];

    render(<ComparisonTable comparisons={mockComparisons} />);

    expect(screen.getByText(/Match:/).parentElement).toHaveTextContent("1 skill");
    expect(screen.getByText(/Exceeds:/).parentElement).toHaveTextContent("1 skill");
    expect(screen.getByText(/Gap:/).parentElement).toHaveTextContent("1 skill");
    expect(screen.getByText(/Unassessed:/).parentElement).toHaveTextContent("1 skill");
  });
});
