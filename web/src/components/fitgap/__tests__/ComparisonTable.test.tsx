import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import type { SkillComparison } from "@/types";

const comparisons: SkillComparison[] = [
  {
    skill_id: "react",
    skill_label: "React",
    expected_level: 4,
    candidate_level: 3,
    ai_level: 2,
    rating_source: "assessor_override",
    result: "gap",
    delta: -1,
    confidence: "high",
  },
  {
    skill_id: "database",
    skill_label: "Database",
    expected_level: 3,
    candidate_level: 3,
    ai_level: 3,
    rating_source: "ai",
    result: "match",
    delta: 0,
    confidence: "medium",
  },
  {
    skill_id: "system",
    skill_label: "System Design",
    expected_level: 5,
    candidate_level: null,
    ai_level: null,
    rating_source: null,
    result: "not_assessed",
    delta: null,
    confidence: null,
  },
];

describe("ComparisonTable", () => {
  it("renders required levels and descriptive rating provenance", () => {
    render(<ComparisonTable comparisons={comparisons} />);

    const reactRow = screen.getByText("React").closest("tr");
    expect(reactRow).not.toBeNull();
    expect(within(reactRow!).getByText("L4")).toBeInTheDocument();
    expect(within(reactRow!).getByText("L3")).toBeInTheDocument();
    expect(within(reactRow!).getByText("Assessor-adjusted from L2")).toBeInTheDocument();
    expect(within(reactRow!).getByText("high confidence")).toBeInTheDocument();

    const databaseRow = screen.getByText("Database").closest("tr");
    expect(databaseRow).not.toBeNull();
    expect(within(databaseRow!).getByText("AI rating")).toBeInTheDocument();

    const systemRow = screen.getByText("System Design").closest("tr");
    expect(systemRow).not.toBeNull();
    expect(within(systemRow!).getByText(/Not assessed/)).toBeInTheDocument();
  });

  it("prioritizes gaps before matches and unassessed skills", () => {
    render(<ComparisonTable comparisons={[comparisons[1], comparisons[2], comparisons[0]]} />);

    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]).getByText("React")).toBeInTheDocument();
    expect(within(rows[1]).getByText("System Design")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Database")).toBeInTheDocument();
  });

  it("renders an explicit empty state", () => {
    render(<ComparisonTable comparisons={[]} />);

    expect(screen.getByText("No matching skills for this vacancy")).toBeInTheDocument();
  });

  it("keeps legacy fit_result comparisons readable", () => {
    render(
      <ComparisonTable
        comparisons={[
          {
            skill_label: "Legacy Rails",
            fit_result: "match",
            note: "Evidence strongly supports this role.",
          },
        ]}
      />
    );

    const row = screen.getByText("Legacy Rails").closest("tr");
    expect(row).not.toBeNull();
    expect(within(row!).getByText(/Match/)).toBeInTheDocument();
  });
});
