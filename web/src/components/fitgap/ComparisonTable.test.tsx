import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import ComparisonTable from "./ComparisonTable";
import type { SkillComparison } from "@/types";

// Data diambil dari respons nyata GET /api/v1/portfolios/:id/fitgap/:vacancy_id
// (skill & level fiktif dari uji alur lokal).
const comparisons = [
  { skill_label: "Database Design & SQL", expected_level: 3, candidate_level: 3, result: "match", delta: 0 },
  { skill_label: "RESTful API Design", expected_level: 3, candidate_level: 2, result: "gap", delta: -1 },
] as unknown as SkillComparison[];

describe("ComparisonTable", () => {
  it("renders one row per compared skill", () => {
    render(<ComparisonTable comparisons={comparisons} />);

    const rows = screen.getAllByRole("row");
    // 1 baris header + 2 baris skill
    expect(rows).toHaveLength(3);
    expect(within(rows[1]).getByText("Database Design & SQL")).toBeInTheDocument();
    expect(within(rows[2]).getByText("RESTful API Design")).toBeInTheDocument();
  });

  it("summarises matches and gaps", () => {
    render(<ComparisonTable comparisons={comparisons} />);

    expect(screen.getByText(/Match: 1 skill$/)).toBeInTheDocument();
    expect(screen.getByText(/Gap: 1 skill$/)).toBeInTheDocument();
  });

  it("shows the gap size on the result badge", () => {
    render(<ComparisonTable comparisons={comparisons} />);

    const gapRow = screen.getAllByRole("row")[2];
    expect(within(gapRow).getByText(/-1/)).toBeInTheDocument();
  });
});
