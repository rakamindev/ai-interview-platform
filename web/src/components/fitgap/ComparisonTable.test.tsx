import { render, screen, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ComparisonTable from "./ComparisonTable";
import type { SkillComparison } from "@/types";

const comparison = (o: Partial<SkillComparison> = {}): SkillComparison => ({
  skill_label: "Communication",
  skill_id: null,
  expected_level: 4,
  candidate_level: 2,
  result: "gap",
  delta: -2,
  confidence: "high",
  overridden: false,
  ...o,
});

// The table renders a desktop <table> and a mobile list of the same rows, both
// present in the DOM. Scope to the table so a match is unambiguous.
const table = () => within(screen.getByRole("table"));

describe("ComparisonTable", () => {
  // Read `required_level`; the API sends `expected_level`. Required rendered
  // blank on every row — the one number a gap is judged against.
  it("shows the level the vacancy requires", () => {
    render(<ComparisonTable comparisons={[comparison()]} />);

    const row = table().getByText("Communication").closest("tr")!;
    expect(within(row).getByText("L4")).toBeInTheDocument();
  });

  it("shows the level the candidate reached", () => {
    render(<ComparisonTable comparisons={[comparison()]} />);

    const row = table().getByText("Communication").closest("tr")!;
    expect(within(row).getByText("L2")).toBeInTheDocument();
  });

  it("renders an em dash when the skill was never assessed", () => {
    render(
      <ComparisonTable
        comparisons={[comparison({ candidate_level: null, result: "not_assessed", delta: null })]}
      />,
    );

    const row = table().getByText("Communication").closest("tr")!;
    expect(within(row).getByText("—")).toBeInTheDocument();
  });

  describe("assessor overrides", () => {
    it("marks a row a human corrected", () => {
      render(<ComparisonTable comparisons={[comparison({ overridden: true })]} />);

      expect(table().getByLabelText("assessor override")).toBeInTheDocument();
    });

    it("leaves an untouched row unmarked", () => {
      render(<ComparisonTable comparisons={[comparison()]} />);

      expect(table().queryByLabelText("assessor override")).not.toBeInTheDocument();
    });

    // Printed unconditionally, promising a marker that could never appear.
    it("only shows the legend when a marker is on the page", () => {
      render(<ComparisonTable comparisons={[comparison()]} />);

      expect(screen.queryByText(/= assessor override/)).not.toBeInTheDocument();
    });

    it("shows the legend when one is", () => {
      render(<ComparisonTable comparisons={[comparison({ overridden: true })]} />);

      expect(screen.getByText(/= assessor override/)).toBeInTheDocument();
    });
  });

  describe("summary", () => {
    it("counts skills nobody assessed, rather than omitting them", () => {
      render(
        <ComparisonTable
          comparisons={[
            comparison(),
            comparison({ skill_label: "System Design", result: "not_assessed", candidate_level: null }),
          ]}
        />,
      );

      expect(screen.getByText(/Not assessed: 1 skill/)).toBeInTheDocument();
    });

    it("omits categories with no rows", () => {
      render(<ComparisonTable comparisons={[comparison()]} />);

      expect(screen.queryByText(/Match:/)).not.toBeInTheDocument();
    });
  });

  it("renders every comparison", () => {
    render(
      <ComparisonTable
        comparisons={[comparison(), comparison({ skill_label: "System Design" })]}
      />,
    );

    expect(table().getAllByRole("row")).toHaveLength(3); // header + 2
  });
});
