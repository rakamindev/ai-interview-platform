import { render, screen, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ComparisonTable, { requiredLevelOf } from "../ComparisonTable";
import type { SkillComparison } from "@/types";

// jsdom ignores CSS, so both the desktop table and the phone list render; scope to one.
const table = () => within(screen.getByRole("table"));
const list = () => within(screen.getByRole("list", { name: "Skill comparison" }));
const rowFor = (label: string) => table().getByText(label).closest("tr")!;

describe("ComparisonTable Component", () => {
  it("renders comparisons with expected_level or required_level correctly", () => {
    const mockComparisons: SkillComparison[] = [
      {
        skill_label: "React / Frontend Development",
        expected_level: 3,
        candidate_level: 3,
        result: "match",
        delta: 0,
      },
      {
        skill_label: "System Design",
        expected_level: 4,
        candidate_level: 2,
        result: "gap",
        delta: -2,
        is_override: true,
      },
      {
        skill_label: "Communication",
        expected_level: 3,
        candidate_level: undefined,
        result: "not_assessed",
      },
    ];

    render(<ComparisonTable comparisons={mockComparisons} />);

    // Check skill labels rendered
    expect(table().getByText("React / Frontend Development")).toBeInTheDocument();
    expect(table().getByText("System Design")).toBeInTheDocument();
    expect(table().getByText("Communication")).toBeInTheDocument();

    // Check required/expected level rendered (L3, L4, L3)
    expect(table().getByText("L4")).toBeInTheDocument();
    const requiredLevels = table().getAllByText("L3");
    expect(requiredLevels.length).toBeGreaterThanOrEqual(1);

    // Check human override indicator is displayed for overridden skill
    expect(table().getByLabelText("Human assessor override applied")).toBeInTheDocument();

    // Check summary section
    expect(screen.getByText(/Match: 1 skill/i)).toBeInTheDocument();
    expect(screen.getByText(/Gap: 1 skill/i)).toBeInTheDocument();
  });

  it("shows the required level in the row for API payloads using required_level", () => {
    render(
      <ComparisonTable
        comparisons={[{ skill_label: "PostgreSQL", required_level: 4, candidate_level: 5, result: "exceed", delta: 1 }]}
      />,
    );

    const cells = rowFor("PostgreSQL").querySelectorAll("td");
    expect(cells[1]).toHaveTextContent("L4");
    expect(cells[2]).toHaveTextContent("L5");
    expect(cells[3]).toHaveTextContent("Exceeds +1");
  });

  it("prefers required_level and falls back to expected_level for older reports", () => {
    expect(requiredLevelOf({ skill_label: "a", required_level: 2, expected_level: 4, result: "gap" })).toBe(2);
    expect(requiredLevelOf({ skill_label: "a", expected_level: 4, result: "gap" })).toBe(4);
    expect(requiredLevelOf({ skill_label: "a", result: "gap" })).toBeUndefined();
  });

  it("renders Not set instead of crashing when the required level is missing or out of range", () => {
    render(
      <ComparisonTable
        comparisons={[
          { skill_label: "No level", result: "not_assessed" },
          { skill_label: "Odd level", required_level: 7, candidate_level: 3, result: "gap", delta: -4 },
        ]}
      />,
    );

    expect(rowFor("No level").querySelectorAll("td")[1]).toHaveTextContent("Not set");
    expect(rowFor("Odd level").querySelectorAll("td")[1]).toHaveTextContent("L7");
  });

  it("explains not-assessed skills instead of presenting them as gaps", () => {
    render(<ComparisonTable comparisons={[{ skill_label: "Kubernetes", required_level: 2, result: "not_assessed" }]} />);

    expect(rowFor("Kubernetes")).toHaveTextContent("Not assessed");
    expect(screen.getByText(/^Not assessed: 1 skill$/)).toBeInTheDocument();
    expect(screen.getByText(/It is not counted as a gap/)).toBeInTheDocument();
    expect(screen.queryByText(/Gap:/)).not.toBeInTheDocument();
  });

  it("flags overrides sent under either field name and hides the legend when there are none", () => {
    const { rerender } = render(
      <ComparisonTable comparisons={[{ skill_label: "Go", required_level: 3, candidate_level: 3, result: "match", overridden: true }]} />,
    );
    expect(table().getByLabelText("Human assessor override applied")).toBeInTheDocument();
    expect(screen.getByText(/Assessor override/)).toBeInTheDocument();

    rerender(<ComparisonTable comparisons={[{ skill_label: "Go", required_level: 3, candidate_level: 3, result: "match" }]} />);
    expect(screen.queryByLabelText("Human assessor override applied")).not.toBeInTheDocument();
    expect(screen.queryByText(/Assessor override/)).not.toBeInTheDocument();
  });

  it("keeps very long skill labels intact", () => {
    const longLabel = "Distributed systems design for multi-region payment reconciliation ".repeat(4).trim();
    render(<ComparisonTable comparisons={[{ skill_label: longLabel, required_level: 3, result: "not_assessed" }]} />);

    expect(table().getByText(longLabel)).toHaveClass("break-words");
    expect(list().getByText(longLabel)).toHaveClass("break-words");
  });

  it("renders the same data in the phone layout", () => {
    render(
      <ComparisonTable
        comparisons={[
          { skill_label: "System Design", required_level: 4, candidate_level: 3, result: "gap", delta: -1, is_override: true },
          { skill_label: "Kubernetes", required_level: 2, result: "not_assessed" },
        ]}
      />,
    );

    const items = list().getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("System Design");
    expect(items[0]).toHaveTextContent("Required L4 · Candidate L3");
    expect(items[0]).toHaveTextContent("Gap -1");
    expect(within(items[0]).getByLabelText("Human assessor override applied")).toBeInTheDocument();
    expect(items[1]).toHaveTextContent("Candidate none");
    expect(items[1]).toHaveTextContent("Not assessed");
  });

  it("shows an empty state for a vacancy without skills", () => {
    render(<ComparisonTable comparisons={[]} />);

    expect(screen.getByText("No required skills on this vacancy")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
