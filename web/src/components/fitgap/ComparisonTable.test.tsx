import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import type { SkillComparison } from "@/types";

const matchRow: SkillComparison = {
  skill_label: "React / Frontend Development Core",
  expected_level: 3,
  candidate_level: 3,
  result: "match",
  delta: 0,
  confidence: "high",
  assessed: true,
  overridden: false,
};

describe("ComparisonTable", () => {
  it("renders required and candidate levels from the backend contract", () => {
    render(<ComparisonTable comparisons={[matchRow]} />);
    // required (expected_level) → L3
    expect(screen.getAllByText("L3").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/Match/).length).toBeGreaterThanOrEqual(2);
  });

  it("shows — for unassessed skills instead of a fake level", () => {
    const row: SkillComparison = {
      ...matchRow,
      candidate_level: null,
      result: "not_assessed",
      assessed: false,
      delta: null,
    };
    render(<ComparisonTable comparisons={[row]} />);
    // Old bug: read c.required_level (undefined) → blank column; fallback level → L1.
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("L1")).not.toBeInTheDocument();
    expect(screen.getByText(/Not assessed/)).toBeInTheDocument();
  });

  it("flags overridden rows with the pencil mark", () => {
    const row: SkillComparison = { ...matchRow, overridden: true, candidate_level: 4 };
    render(<ComparisonTable comparisons={[row]} />);
    expect(screen.getByText("✏")).toBeInTheDocument();
  });
});