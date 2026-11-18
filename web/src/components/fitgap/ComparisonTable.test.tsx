import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ComparisonTable from "./ComparisonTable";
import type { SkillComparison } from "@/types";

describe("ComparisonTable", () => {
  const sampleComparisons: SkillComparison[] = [
    {
      skill_label: "Ruby on Rails Architecture",
      required_level: 4,
      candidate_level: 4,
      result: "match",
      delta: 0,
      is_override: false,
      is_assessed: true,
    },
    {
      skill_label: "PostgreSQL Optimization",
      required_level: 4,
      candidate_level: 5,
      result: "exceed",
      delta: 1,
      is_override: true,
      ai_level: 3,
      assessor_notes: "Strong knowledge of EXPLAIN ANALYZE and partitioning.",
      is_assessed: true,
    },
    {
      skill_label: "Kubernetes Cluster Ops",
      required_level: 3,
      candidate_level: 2,
      result: "gap",
      delta: -1,
      is_override: false,
      is_assessed: true,
    },
    {
      skill_label: "GraphQL Federation",
      required_level: 3,
      candidate_level: null,
      result: "not_assessed",
      delta: null,
      is_override: false,
      is_assessed: false,
    },
  ];

  it("renders all comparison rows with required and candidate levels", () => {
    render(<ComparisonTable comparisons={sampleComparisons} />);

    expect(screen.getByText("Ruby on Rails Architecture")).toBeInTheDocument();
    expect(screen.getByText("PostgreSQL Optimization")).toBeInTheDocument();
    expect(screen.getByText("Kubernetes Cluster Ops")).toBeInTheDocument();
    expect(screen.getByText("GraphQL Federation")).toBeInTheDocument();

    // Check badges using getAllByText or specific queries
    expect(screen.getAllByText("Match").length).toBeGreaterThan(0);
    expect(screen.getByText(/Exceeds \+1/)).toBeInTheDocument();
    expect(screen.getByText(/Gap -1/)).toBeInTheDocument();
    expect(screen.getAllByText("Not assessed").length).toBeGreaterThan(0);
  });

  it("displays human override indicator and assessor note", () => {
    render(<ComparisonTable comparisons={sampleComparisons} />);

    expect(screen.getByText(/Override \(AI: L3\)/)).toBeInTheDocument();
    expect(
      screen.getByText("Strong knowledge of EXPLAIN ANALYZE and partitioning.")
    ).toBeInTheDocument();
  });

  it("computes and renders match rate summary metrics correctly", () => {
    render(<ComparisonTable comparisons={sampleComparisons} />);

    // 2 out of 4 satisfied (match + exceed = 2/4 = 50%)
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("2 of 4 satisfied")).toBeInTheDocument();
  });

  it("handles unassessed skill without crashing and shows 'Not assessed'", () => {
    render(<ComparisonTable comparisons={sampleComparisons} />);

    const notAssessedElements = screen.getAllByText("Not assessed");
    expect(notAssessedElements.length).toBeGreaterThanOrEqual(1);
  });
});
