import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ComparisonTable from "./ComparisonTable";
import type { SkillComparison } from "@/types";

// Contract mirror:
// backend sends expected_level / is_override / low_confidence_flag
// (see api/app/services/fit_gap/engine.rb). This table must render those,
// never the old required_level naming.
describe("ComparisonTable", () => {
  const base: SkillComparison = {
    skill_label: "React / Frontend Development",
    skill_id: "SK-ENG-001",
    expected_level: 3,
    result: "gap",
    candidate_level: 2,
    delta: -1,
    confidence: "low",
    is_override: false,
    low_confidence_flag: true,
  };

  it("renders the required level from expected_level", () => {
    render(<ComparisonTable comparisons={[base]} />);
    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("L3");
  });

  it("marks a human override next to the candidate level", () => {
    render(<ComparisonTable comparisons={[{ ...base, is_override: true, low_confidence_flag: false }]} />);
    expect(screen.getAllByRole("row")[1]).toHaveTextContent("✏️");
  });

  it("flags low-confidence verdicts so they are not treated as facts", () => {
    render(<ComparisonTable comparisons={[base]} />);
    expect(screen.getByText("low confidence")).toBeInTheDocument();
  });

  it("labels not_assessed rows as not probed instead of hiding them", () => {
    render(
      <ComparisonTable
        comparisons={[{
          ...base,
          result: "not_assessed",
          candidate_level: null,
          delta: null,
          confidence: null,
          low_confidence_flag: true,
        }]}
      />
    );
    expect(screen.getByText("not probed")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("does not flag a high-confidence match", () => {
    render(
      <ComparisonTable
        comparisons={[{
          ...base,
          result: "match",
          candidate_level: 3,
          delta: 0,
          confidence: "high",
          low_confidence_flag: false,
        }]}
      />
    );
    expect(screen.queryByText("low confidence")).not.toBeInTheDocument();
  });

  it("shows a friendly empty state when the vacancy has no skills", () => {
    render(<ComparisonTable comparisons={[]} />);
    expect(screen.getByText(/no required skills defined/i)).toBeInTheDocument();
  });
});