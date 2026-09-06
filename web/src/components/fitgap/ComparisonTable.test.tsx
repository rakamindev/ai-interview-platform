import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import ComparisonTable from "./ComparisonTable";
import type { SkillComparison } from "@/types";

/**
 * These fixtures are transcribed from a real N13 response captured from the
 * running API (GET /api/v1/portfolios/1/fitgap/1), not hand-written to match the
 * component. That distinction matters: the defect this suite pins down is a
 * contract mismatch, and a fixture shaped to the component's expectations would
 * have hidden it.
 */
const wellEvidencedMatch: SkillComparison = {
  skill_label: "React / Frontend Development Core",
  skill_id: "SK-ENG-001",
  candidate_level: 3,
  expected_level: 3,
  result: "match",
  delta: 0,
  confidence: "high",
  ai_level: 3,
  is_override: false,
  evidence_count: 3,
};

const thinlyEvidencedMatch: SkillComparison = {
  skill_label: "Micro-frontend Architecture",
  skill_id: null,
  candidate_level: 2,
  expected_level: 2,
  result: "match",
  delta: 0,
  confidence: "low",
  ai_level: 2,
  is_override: false,
  evidence_count: 1,
};

const overriddenMatch: SkillComparison = {
  skill_label: "Communication",
  skill_id: null,
  candidate_level: 3,
  expected_level: 3,
  result: "match",
  delta: 0,
  confidence: "medium",
  ai_level: 2,
  is_override: true,
  evidence_count: 3,
};

const gap: SkillComparison = {
  skill_label: "RESTful API Design",
  skill_id: "SK-ENG-005",
  candidate_level: 2,
  expected_level: 3,
  result: "gap",
  delta: -1,
  confidence: "low",
  ai_level: 2,
  is_override: false,
  evidence_count: 1,
};

const neverAssessed: SkillComparison = {
  skill_label: "Testing & Quality Assurance",
  skill_id: "SK-ENG-006",
  candidate_level: null,
  expected_level: 3,
  result: "not_assessed",
  delta: null,
  confidence: null,
  ai_level: null,
  is_override: false,
  evidence_count: 0,
};

function rowFor(label: string) {
  const row = screen.getByText(label).closest("tr");
  if (!row) throw new Error(`no row rendered for "${label}"`);
  return within(row);
}

/**
 * Scopes an assertion to one column of one row. Necessary because "L3" is a
 * legitimate value in both the Required and the Candidate column, so a
 * row-wide text query is ambiguous exactly when the candidate meets the bar.
 * The `data-label` attribute is not test scaffolding — the component uses it to
 * label each field in its stacked mobile layout.
 */
function cell(rowLabel: string, column: string) {
  const row = screen.getByText(rowLabel).closest("tr");
  if (!row) throw new Error(`no row rendered for "${rowLabel}"`);
  const td = row.querySelector<HTMLElement>(`[data-label="${column}"]`);
  if (!td) throw new Error(`row "${rowLabel}" has no "${column}" cell`);
  return td;
}

describe("ComparisonTable", () => {
  describe("the required level", () => {
    it("renders the level the role requires for every row", () => {
      render(<ComparisonTable comparisons={[wellEvidencedMatch, gap, neverAssessed]} />);

      // The whole point of this screen is a comparison. Without the required
      // level, "L2" tells the reader nothing about whether L2 is enough.
      expect(cell("React / Frontend Development Core", "Required")).toHaveTextContent("L3");
      expect(cell("RESTful API Design", "Required")).toHaveTextContent("L3");
      expect(cell("Testing & Quality Assurance", "Required")).toHaveTextContent("L3");
    });

    it("renders the required level even when the candidate was never assessed", () => {
      render(<ComparisonTable comparisons={[neverAssessed]} />);

      expect(cell("Testing & Quality Assurance", "Required")).toHaveTextContent("L3");
      expect(rowFor("Testing & Quality Assurance").getByText(/not assessed/i)).toBeInTheDocument();
    });
  });

  describe("evidence strength", () => {
    it("distinguishes a well-evidenced match from a thinly-evidenced one", () => {
      render(<ComparisonTable comparisons={[wellEvidencedMatch, thinlyEvidencedMatch]} />);

      // Both rows are "Match". If the screen renders them identically, the
      // reader cannot tell a measurement from a guess.
      expect(rowFor("React / Frontend Development Core").getByText(/high/i)).toBeInTheDocument();
      expect(rowFor("Micro-frontend Architecture").getByText(/low/i)).toBeInTheDocument();
    });

    it("shows how many evidence quotes support each rating", () => {
      render(<ComparisonTable comparisons={[wellEvidencedMatch, gap]} />);

      expect(rowFor("React / Frontend Development Core").getByText(/3\s*quote/i)).toBeInTheDocument();
      expect(rowFor("RESTful API Design").getByText(/1\s*quote/i)).toBeInTheDocument();
    });

    it("reports no confidence for a skill that was never assessed", () => {
      render(<ComparisonTable comparisons={[neverAssessed]} />);

      expect(rowFor("Testing & Quality Assurance").queryByText(/high|medium|low/i)).toBeNull();
    });
  });

  describe("human override", () => {
    it("marks a row whose level was corrected by an assessor", () => {
      render(<ComparisonTable comparisons={[overriddenMatch]} />);

      // The legend promises "human override applied"; the table must be able
      // to keep that promise.
      expect(rowFor("Communication").getByTitle(/override/i)).toBeInTheDocument();
    });

    it("shows the level the model proposed before the correction", () => {
      render(<ComparisonTable comparisons={[overriddenMatch]} />);

      expect(cell("Communication", "Candidate")).toHaveTextContent("L2");
    });

    it("does not mark rows the assessor never touched", () => {
      render(<ComparisonTable comparisons={[wellEvidencedMatch]} />);

      expect(rowFor("React / Frontend Development Core").queryByTitle(/override/i)).toBeNull();
    });
  });

  describe("unassessed requirements", () => {
    it("does not present an unassessed skill as a gap", () => {
      render(<ComparisonTable comparisons={[neverAssessed]} />);

      const row = rowFor("Testing & Quality Assurance");
      expect(row.queryByText(/gap/i)).toBeNull();
      expect(row.getByText(/not assessed/i)).toBeInTheDocument();
    });

    it("counts unassessed requirements in the summary so they cannot be overlooked", () => {
      render(<ComparisonTable comparisons={[wellEvidencedMatch, neverAssessed]} />);

      expect(screen.getByText(/1 skill not assessed/i)).toBeInTheDocument();
    });
  });

  describe("edge cases", () => {
    it("renders an explicit empty state rather than a headerless empty table", () => {
      render(<ComparisonTable comparisons={[]} />);

      expect(screen.getByText(/no skills to compare/i)).toBeInTheDocument();
    });

    it("renders a very long skill label without dropping the row", () => {
      const longLabel = "Distributed Frontend Observability, Performance Budgeting and Release Engineering Practice".repeat(2);
      render(<ComparisonTable comparisons={[{ ...gap, skill_label: longLabel }]} />);

      expect(screen.getByText(longLabel)).toBeInTheDocument();
      expect(cell(longLabel, "Required")).toHaveTextContent("L3");
    });

    it("tolerates a delta of zero on an exceed row without hiding the sign", () => {
      render(<ComparisonTable comparisons={[{ ...wellEvidencedMatch, result: "exceed", delta: 1 }]} />);

      expect(rowFor("React / Frontend Development Core").getByText(/\+1/)).toBeInTheDocument();
    });
  });
});
