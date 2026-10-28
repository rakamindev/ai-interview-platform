import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import ComparisonTable from "../ComparisonTable";
import { comparison } from "@/test/fixtures";

function desktopRow(label: string) {
  return screen.getByRole("row", { name: new RegExp(label) });
}

describe("ComparisonTable", () => {
  it("shows required and candidate levels with the signed delta", () => {
    render(<ComparisonTable comparisons={[comparison({ required_level: 4, candidate_level: 3, result: "gap", delta: -1 })]} />);

    const row = desktopRow("React");
    expect(within(row).getByText("L4")).toBeInTheDocument();
    expect(within(row).getByText("L3")).toBeInTheDocument();
    expect(within(row).getByText(/below -1/i)).toBeInTheDocument();
  });

  it("shows the required level when the API sends only expected_level (the column used to render blank)", () => {
    render(<ComparisonTable comparisons={[comparison({ required_level: undefined, expected_level: 2 })]} />);
    expect(within(desktopRow("React")).getByText("L2")).toBeInTheDocument();
  });

  it("shows a not-assessed skill as not assessed, never as a gap", () => {
    render(
      <ComparisonTable
        comparisons={[
          comparison({ skill_label: "System Design", candidate_level: null, result: "not_assessed", delta: null,
                       not_assessed_reason: "never_reached", needs_review: true }),
        ]}
      />
    );

    const row = desktopRow("System Design");
    expect(within(row).getByText("Not assessed")).toBeInTheDocument();
    expect(within(row).queryByText(/below/i)).not.toBeInTheDocument();
    expect(screen.getByText("1 not assessed")).toBeInTheDocument();
    expect(screen.getByText("0 below required")).toBeInTheDocument();
  });

  it("marks assessor ratings and low-confidence AI ratings", () => {
    render(
      <ComparisonTable
        comparisons={[
          comparison({ skill_label: "Communication", is_override: true }),
          comparison({ skill_label: "Testing", confidence: "low", needs_review: true }),
        ]}
      />
    );

    expect(within(desktopRow("Communication")).getByLabelText("Rated by an assessor")).toBeInTheDocument();
    expect(within(desktopRow("Testing")).getByLabelText(/low confidence/i)).toBeInTheDocument();
  });

  it("renders an empty state when the vacancy has no skills", () => {
    render(<ComparisonTable comparisons={[]} />);
    expect(screen.getByText(/no skill requirements/i)).toBeInTheDocument();
  });
});
