import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ComparisonTable from "./ComparisonTable";
import type { SkillComparison } from "@/types";

describe("ComparisonTable Component", () => {
  const mockComparisons: SkillComparison[] = [
    {
      skill_label: "Ruby on Rails",
      skill_id: "sk-ruby",
      expected_level: 3,
      candidate_level: 3,
      result: "match",
      delta: 0,
      confidence: "high",
      is_override: false,
    },
    {
      skill_label: "React Architecture",
      skill_id: "sk-react",
      expected_level: 3,
      candidate_level: 4,
      result: "exceed",
      delta: 1,
      confidence: "high",
      is_override: true,
    },
    {
      skill_label: "PostgreSQL Database Tuning",
      skill_id: "sk-sql",
      expected_level: 4,
      candidate_level: 2,
      result: "gap",
      delta: -2,
      confidence: "medium",
      is_override: false,
    },
    {
      skill_label: "Kubernetes & DevOps",
      skill_id: "sk-k8s",
      expected_level: 3,
      candidate_level: null,
      result: "not_assessed",
      delta: null,
      confidence: undefined,
      is_override: false,
    },
  ];

  it("renders skill comparison rows with required and candidate levels", () => {
    render(<ComparisonTable comparisons={mockComparisons} />);

    expect(screen.getByText("Ruby on Rails")).toBeInTheDocument();
    expect(screen.getByText("React Architecture")).toBeInTheDocument();
    expect(screen.getByText("PostgreSQL Database Tuning")).toBeInTheDocument();
    expect(screen.getByText("Kubernetes & DevOps")).toBeInTheDocument();

    // Check result badges
    expect(screen.getAllByText(/Match/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Exceed/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Gap/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Not Assessed/i).length).toBeGreaterThan(0);
  });

  it("renders the assessor adjusted tag when is_override is true", () => {
    render(<ComparisonTable comparisons={mockComparisons} />);
    expect(screen.getByText("✏ Adjusted")).toBeInTheDocument();
  });

  it("renders summary counters accurately", () => {
    render(<ComparisonTable comparisons={mockComparisons} />);
    expect(screen.getByText(/✓ 1 Match/i)).toBeInTheDocument();
    expect(screen.getByText(/★ 1 Exceed/i)).toBeInTheDocument();
    expect(screen.getByText(/⚠ 1 Gap/i)).toBeInTheDocument();
    expect(screen.getByText(/— 1 Not Assessed/i)).toBeInTheDocument();
  });

  it("renders empty state message when comparisons array is empty", () => {
    render(<ComparisonTable comparisons={[]} />);
    expect(screen.getByText(/No skill requirements configured/i)).toBeInTheDocument();
  });
});
