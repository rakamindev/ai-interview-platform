import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import ComparisonTable from "../ComparisonTable";
import { comparison } from "@/test/fixtures";

function desktopTable() {
  return screen.getByRole("table");
}

describe("ComparisonTable", () => {
  it("shows the required level from the API's expected_level field", () => {
    render(<ComparisonTable comparisons={[comparison({ expected_level: 4, candidate_level: 3, result: "gap", delta: -1 })]} />);

    const row = within(desktopTable()).getByRole("row", { name: /React/ });
    expect(within(row).getByText("L4")).toBeInTheDocument();
    expect(within(row).getByText("L3")).toBeInTheDocument();
    expect(within(row).getByText(/Gap/)).toHaveTextContent("Gap −1");
  });

  it("does not count not-assessed skills as gaps", () => {
    render(
      <ComparisonTable
        comparisons={[
          comparison({ skill_label: "Testing", expected_level: 3, candidate_level: 2, result: "gap", delta: -1 }),
          comparison({
            skill_label: "System Design",
            candidate_level: null,
            ai_level: null,
            result: "not_assessed",
            delta: null,
            rating_status: "not_assessed",
          }),
        ]}
      />
    );

    expect(screen.getByText(/1 gap/)).toHaveTextContent("0 match · 0 exceed · 1 gap");
    expect(screen.getByText(/1 gap/)).toHaveTextContent("1 not assessed (no evidence either way, not counted as a gap)");
    const row = within(desktopTable()).getByRole("row", { name: /System Design/ });
    expect(within(row).getByText("Not assessed: not counted")).toBeInTheDocument();
    expect(within(row).getByText("—")).toBeInTheDocument();
  });

  it("flags low-confidence ratings and assessor overrides", () => {
    render(
      <ComparisonTable
        comparisons={[
          comparison({ skill_label: "Go", low_confidence: true, result: "gap", candidate_level: 2, delta: -1 }),
          comparison({ skill_label: "SQL", overridden: true, ai_level: 2 }),
        ]}
      />
    );

    const table = desktopTable();
    expect(within(table).getByText("Low confidence: verify before deciding")).toBeInTheDocument();
    expect(within(table).getByText("Assessor override (AI said L2)")).toBeInTheDocument();
  });

  it("explains what to do when the vacancy has no skills", () => {
    render(<ComparisonTable comparisons={[]} />);

    expect(screen.getByText(/Add skills to the vacancy/)).toBeInTheDocument();
  });
});
