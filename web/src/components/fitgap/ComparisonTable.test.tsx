import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ComparisonTable from "./ComparisonTable";
import type { SkillComparison } from "@/types";

const base: SkillComparison = {
  skill_label: "Ruby",
  required_level: 3,
  candidate_level: 3,
  result: "match",
  delta: 0,
  is_override: false,
  confidence: "high",
};

describe("ComparisonTable", () => {
  it("renders all comparison result types", () => {
    const comparisons: SkillComparison[] = [
      base,
      { ...base, skill_label: "SQL", candidate_level: 1, result: "gap", delta: -2, confidence: "medium" },
      { ...base, skill_label: "React", candidate_level: 5, result: "exceed", delta: 2, confidence: "low" },
      { ...base, skill_label: "Go", candidate_level: null, result: "not_assessed", delta: null, confidence: null },
    ];
    render(<ComparisonTable comparisons={comparisons} />);

    expect(screen.getByText("Ruby")).toBeInTheDocument();
    expect(screen.getByText(/Gap: 1 skill/)).toBeInTheDocument();
    expect(screen.getByText(/Match: 1 skill/)).toBeInTheDocument();
    expect(screen.getByText(/Exceeds: 1 skill/)).toBeInTheDocument();
  });

  it("shows dash for unassessed candidate level and missing confidence", () => {
    render(
      <ComparisonTable
        comparisons={[{ ...base, skill_label: "Go", candidate_level: null, result: "not_assessed", delta: null, confidence: null }]}
      />
    );
    // candidate level dash + confidence dash
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });

  it("marks overridden levels with the override indicator", () => {
    render(<ComparisonTable comparisons={[{ ...base, is_override: true }]} />);
    expect(screen.getAllByText("✏").length).toBeGreaterThanOrEqual(1);
  });

  it("shows signed delta on gap results", () => {
    render(
      <ComparisonTable
        comparisons={[{ ...base, skill_label: "SQL", candidate_level: 1, result: "gap", delta: -2 }]}
      />
    );
    expect(screen.getByText(/-2/)).toBeInTheDocument();
  });
});