import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import { LEVEL_LABELS } from "@/utils/constants";
import type { SkillComparison } from "@/types";

describe("ComparisonTable — Required column (F16 regression)", () => {
  it("renders the Required level from expected_level, not blank", () => {
    const comparisons: SkillComparison[] = [
      {
        skill_label: "RESTful API Design",
        expected_level: 4,
        candidate_level: 1,
        result: "gap",
        delta: -3,
      },
      {
        skill_label: "React / Frontend Development Core",
        expected_level: 4,
        result: "not_assessed",
      },
    ];

    render(<ComparisonTable comparisons={comparisons} />);

    const rows = screen.getAllByRole("row").slice(1); // drop header row
    expect(rows).toHaveLength(2);

    // Both rows expect level 4 — the Required cell must show its label, not be empty.
    for (const row of rows) {
      const requiredCell = within(row).getAllByRole("cell")[1];
      expect(requiredCell).toHaveTextContent(LEVEL_LABELS[4]);
      expect(requiredCell.textContent?.trim()).not.toBe("");
    }
  });

  it("still renders '—' for a missing candidate_level, distinct from a missing Required value", () => {
    const comparisons: SkillComparison[] = [
      { skill_label: "Unassessed skill", expected_level: 3, result: "not_assessed" },
    ];

    render(<ComparisonTable comparisons={comparisons} />);

    const row = screen.getAllByRole("row")[1];
    const cells = within(row).getAllByRole("cell");
    expect(cells[1]).toHaveTextContent(LEVEL_LABELS[3]); // Required — present
    expect(cells[2]).toHaveTextContent("—"); // Candidate — genuinely absent
  });
});
