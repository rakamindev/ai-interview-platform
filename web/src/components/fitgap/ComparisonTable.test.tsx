import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import ComparisonTable from "./ComparisonTable";
import contract from "../../../../contracts/fit_gap_report.example.json";
import type { SkillComparison } from "@/types";

// The API spec checks its serializer against the same file, so a field renamed on either side
// fails one of the two suites (finding F3: the "Required" column was blank on every report).
const comparisons = contract.skill_comparisons as SkillComparison[];

function rowFor(label: string) {
  return screen.getByRole("row", { name: new RegExp(label) });
}

describe("ComparisonTable (contract)", () => {
  it("shows the required level on every row", () => {
    render(<ComparisonTable comparisons={comparisons} />);

    for (const c of comparisons) {
      const requiredCell = within(rowFor(c.skill_label)).getAllByRole("cell")[1];
      expect(requiredCell).toHaveTextContent(`L${c.expected_level}`);
    }
  });

  it("marks a low-confidence result as provisional", () => {
    render(<ComparisonTable comparisons={comparisons} />);

    const row = within(rowFor("Testing & Quality Assurance"));
    expect(row.getByText("Match")).toBeInTheDocument();
    expect(row.getByText("Provisional")).toBeInTheDocument();
  });

  it("shows when an assessor set the level, and what the AI said", () => {
    render(<ComparisonTable comparisons={comparisons} />);

    const row = within(rowFor("Communication"));
    expect(row.getByText("Set by assessor")).toBeInTheDocument();
    expect(row.getByText("AI: not assessed")).toBeInTheDocument();
  });

  it("never shows an unmeasured or unreviewed skill as a gap", () => {
    render(<ComparisonTable comparisons={comparisons} />);

    expect(within(rowFor("Security Engineering")).getByText("Not assessed")).toBeInTheDocument();
    expect(within(rowFor("TypeScript & Type Systems")).getByText("Needs review")).toBeInTheDocument();
    expect(screen.queryByText("Gap")).not.toBeInTheDocument();
  });

  it("counts every outcome in the summary, keeping provisional results out of match and gap", () => {
    render(<ComparisonTable comparisons={comparisons} />);

    const summary = within(screen.getByRole("list", { name: "Summary" }));
    expect(summary.getByText("1 match")).toBeInTheDocument();
    expect(summary.getByText("1 exceeds")).toBeInTheDocument();
    expect(summary.getByText("1 provisional")).toBeInTheDocument();
    expect(summary.getByText("1 not assessed")).toBeInTheDocument();
    expect(summary.getByText("1 needs review")).toBeInTheDocument();
  });

  it("explains an empty comparison instead of rendering an empty table", () => {
    render(<ComparisonTable comparisons={[]} />);

    expect(screen.getByText("This vacancy has no required skills to compare against.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
