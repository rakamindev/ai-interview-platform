import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ComparisonTable from "../ComparisonTable";
import type { SkillComparison } from "@/types";

describe("ComparisonTable (Finding F-6: API contract & required fields display)", () => {
  const mockComparisons: SkillComparison[] = [
    {
      skill_label: "Ruby on Rails",
      expected_level: 4,
      candidate_level: 4,
      result: "match",
      delta: 0,
      is_override: false,
    },
    {
      skill_label: "System Design",
      expected_level: 4,
      candidate_level: 5,
      result: "exceed",
      delta: 1,
      is_override: true,
    },
    {
      skill_label: "React",
      expected_level: 4,
      candidate_level: 2,
      result: "gap",
      delta: -2,
      is_override: false,
    },
    {
      skill_label: "Kubernetes",
      expected_level: 3,
      candidate_level: undefined,
      result: "not_assessed",
      delta: undefined,
      is_override: false,
    },
  ];

  it("renders all required columns and headers (Skill, Required, Candidate, Result)", () => {
    render(<ComparisonTable comparisons={mockComparisons} />);

    expect(screen.getByText("Skill")).toBeInTheDocument();
    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(screen.getByText("Candidate")).toBeInTheDocument();
    expect(screen.getByText("Result")).toBeInTheDocument();
  });

  it("displays skill labels, levels, and badges correctly matching API contract", () => {
    render(<ComparisonTable comparisons={mockComparisons} />);

    expect(screen.getByText("Ruby on Rails")).toBeInTheDocument();
    expect(screen.getByText("System Design")).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("Kubernetes")).toBeInTheDocument();

    // Badges
    expect(screen.getAllByText(/Match/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Exceed/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Gap/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Not Assessed/i).length).toBeGreaterThan(0);
  });

  it("renders override indicator icon (✏) for overridden skills", () => {
    render(<ComparisonTable comparisons={mockComparisons} />);

    // System Design has is_override: true
    expect(screen.getByText("✏")).toBeInTheDocument();
  });
});
