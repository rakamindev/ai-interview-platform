import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ComparisonTable from "../components/fitgap/ComparisonTable";
import type { SkillComparison } from "@/types";

describe("ComparisonTable (Fit/Gap Visual Mapping)", () => {
  const mockComparisons: SkillComparison[] = [
    {
      skill_label: "Ruby on Rails",
      required_level: 4,
      candidate_level: 4,
      result: "match",
      delta: 0,
      is_override: false,
    },
    {
      skill_label: "Distributed Systems",
      required_level: 4,
      candidate_level: 5,
      result: "exceed",
      delta: 1,
      is_override: true,
    },
    {
      skill_label: "PostgreSQL Optimization",
      required_level: 4,
      candidate_level: 2,
      result: "gap",
      delta: -2,
      is_override: false,
    },
    {
      skill_label: "GraphQL Federation",
      required_level: 3,
      candidate_level: undefined,
      result: "not_assessed",
      delta: undefined,
      is_override: false,
    },
  ];

  it("renders all skill comparison rows with correct badges and override indicators", () => {
    render(<ComparisonTable comparisons={mockComparisons} />);

    expect(screen.getByText("Ruby on Rails")).toBeInTheDocument();
    expect(screen.getByText("Distributed Systems")).toBeInTheDocument();
    expect(screen.getByText("PostgreSQL Optimization")).toBeInTheDocument();
    expect(screen.getByText("GraphQL Federation")).toBeInTheDocument();

    // Check results badges
    expect(screen.getAllByText(/Match/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Exceeds/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Gap/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Not assessed/i).length).toBeGreaterThanOrEqual(1);

    // Human override pencil icon should be present for Distributed Systems
    expect(screen.getAllByText("✏").length).toBeGreaterThanOrEqual(1);
  });

  it("renders aggregated summary counts including unassessed skills", () => {
    render(<ComparisonTable comparisons={mockComparisons} />);

    expect(screen.getByText(/Match: 1 skill/i)).toBeInTheDocument();
    expect(screen.getByText(/Gap: 1 skill/i)).toBeInTheDocument();
    expect(screen.getByText(/Exceeds: 1 skill/i)).toBeInTheDocument();
    expect(screen.getByText(/Not Assessed: 1 skill/i)).toBeInTheDocument();
  });
});
