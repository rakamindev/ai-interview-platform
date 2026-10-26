import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ComparisonTable from "./ComparisonTable";
import type { SkillComparison } from "@/types";

// Baseline behaviour. Fixtures originally used the web's wrong `required_level` key (finding F2);
// they now use the field the API actually sends. Assertions are unchanged.
describe("ComparisonTable", () => {
  const comparisons = [
    { skill_label: "Communication", expected_level: 3, candidate_level: 3, result: "match", delta: 0 },
    { skill_label: "SQL", expected_level: 4, candidate_level: 2, result: "gap", delta: -2 },
  ] as SkillComparison[];

  it("renders one row per skill with its result badge", () => {
    render(<ComparisonTable comparisons={comparisons} />);

    const sqlRow = screen.getByText("SQL").closest("tr")!;
    expect(within(sqlRow).getByText(/Gap/)).toHaveTextContent("Gap -2");
    expect(screen.getByText("Communication").closest("tr")).toHaveTextContent("Match");
  });

  it("marks a skill the candidate was never assessed on", () => {
    render(
      <ComparisonTable
        comparisons={[{ skill_label: "Kubernetes", expected_level: 2, candidate_level: null, result: "not_assessed", delta: null }]}
      />,
    );

    expect(screen.getByText("Kubernetes").closest("tr")).toHaveTextContent("Not assessed");
  });
});

// Revamp contract — rows exactly as the API serialises them (assessment/02-strategy.md AC18–AC21).
describe("ComparisonTable with the API payload", () => {
  const apiComparisons = [
    { skill_label: "SQL", expected_level: 4, candidate_level: 4, ai_level: 2, result: "match", delta: 0, is_override: true, low_confidence: false },
    { skill_label: "Communication", expected_level: 3, candidate_level: 2, ai_level: 2, result: "gap", delta: -1, is_override: false, low_confidence: true },
    { skill_label: "Kubernetes", expected_level: 2, candidate_level: null, result: "not_assessed", delta: null, is_override: false, low_confidence: false },
  ] as unknown as SkillComparison[];

  const row = (label: string) => screen.getByText(label).closest("tr")!;

  it("shows the required level the API sends for every row (AC18)", () => {
    render(<ComparisonTable comparisons={apiComparisons} />);

    // Column 2 is "Required"; asserting the cell, not the row, so the candidate level can't satisfy it.
    const requiredCell = (label: string) => row(label).querySelectorAll("td")[1];
    expect(requiredCell("SQL")).toHaveTextContent("L4");
    expect(requiredCell("Communication")).toHaveTextContent("L3");
    expect(requiredCell("Kubernetes")).toHaveTextContent("L2");
  });

  it("marks human overrides and only those (AC19)", () => {
    render(<ComparisonTable comparisons={apiComparisons} />);

    expect(within(row("SQL")).getByLabelText("Human override")).toBeInTheDocument();
    expect(within(row("Communication")).queryByLabelText("Human override")).not.toBeInTheDocument();
  });

  it("flags a result backed by low-confidence evidence (AC21)", () => {
    render(<ComparisonTable comparisons={apiComparisons} />);

    expect(row("Communication")).toHaveTextContent(/low confidence/i);
    expect(row("SQL")).not.toHaveTextContent(/low confidence/i);
  });

  it("counts unassessed skills in the summary instead of hiding them (AC20)", () => {
    render(<ComparisonTable comparisons={apiComparisons} />);

    expect(screen.getByText(/Not assessed: 1 skill/)).toBeInTheDocument();
  });
});
