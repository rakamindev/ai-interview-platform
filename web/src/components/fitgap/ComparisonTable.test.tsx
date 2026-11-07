import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import ComparisonTable from "./ComparisonTable";
import type { SkillComparison } from "@/types";

// Rows follow the GET /api/v1/portfolios/:id/fitgap/:vacancy_id response
// after the F-06/F-07 fix (fictional data).
const rows: SkillComparison[] = [
  {
    skill_label: "Database Design & SQL",
    required_level: 3,
    candidate_level: 3,
    ai_level: 3,
    is_override: false,
    override_reason: null,
    result: "match",
    delta: 0,
  },
  {
    skill_label: "RESTful API Design",
    required_level: 3,
    candidate_level: 2,
    ai_level: 3,
    is_override: true,
    override_reason: "Jawaban versioning masih teoretis, belum ada contoh nyata.",
    result: "gap",
    delta: -1,
  },
];

function bodyRows() {
  // the first row is the header
  return screen.getAllByRole("row").slice(1);
}

function cells(row: HTMLElement) {
  return within(row).getAllByRole("cell");
}

describe("ComparisonTable", () => {
  it("renders one row per compared skill", () => {
    render(<ComparisonTable comparisons={rows} />);

    expect(bodyRows()).toHaveLength(2);
    expect(within(bodyRows()[0]).getByText("Database Design & SQL")).toBeInTheDocument();
  });

  it("shows the level required by the vacancy (F-06)", () => {
    render(<ComparisonTable comparisons={rows} />);

    expect(cells(bodyRows()[0])[1]).toHaveTextContent("L3");
    expect(cells(bodyRows()[1])[1]).toHaveTextContent("L3");
  });

  it("falls back to expected_level for reports generated before the fix", () => {
    const legacy = [
      { skill_label: "Database Design & SQL", expected_level: 4, candidate_level: 3, result: "gap", delta: -1 },
    ] as unknown as SkillComparison[];

    render(<ComparisonTable comparisons={legacy} />);

    expect(cells(bodyRows()[0])[1]).toHaveTextContent("L4");
    expect(screen.queryByText(/corrected/i)).not.toBeInTheDocument();
  });

  it("marks assessor-corrected levels with the original AI level and the reason (F-07)", () => {
    render(<ComparisonTable comparisons={rows} />);

    const corrected = cells(bodyRows()[1])[2];
    expect(corrected).toHaveTextContent("L2");
    expect(within(corrected).getByText(/corrected/i)).toBeInTheDocument();
    expect(within(corrected).getByText("AI L3")).toBeInTheDocument();

    const notes = screen.getByRole("list", { name: /assessor corrections/i });
    expect(within(notes).getByText(/RESTful API Design/)).toBeInTheDocument();
    expect(within(notes).getByText(/Jawaban versioning masih teoretis/)).toBeInTheDocument();
  });

  it("does not mark rows that the assessor did not correct", () => {
    render(<ComparisonTable comparisons={rows} />);

    expect(within(cells(bodyRows()[0])[2]).queryByText(/corrected/i)).not.toBeInTheDocument();
  });

  it("summarises matches and gaps and shows the gap size", () => {
    render(<ComparisonTable comparisons={rows} />);

    expect(screen.getByText(/Match: 1 skill$/)).toBeInTheDocument();
    expect(screen.getByText(/Gap: 1 skill$/)).toBeInTheDocument();
    expect(within(bodyRows()[1]).getByText(/-1/)).toBeInTheDocument();
  });
});
