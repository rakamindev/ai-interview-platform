import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ComparisonTable from "./ComparisonTable";
import type { SkillComparison } from "@/types";

function comparison(overrides: Partial<SkillComparison>): SkillComparison {
  return {
    skill_label: "Skill",
    skill_id: "SK-1",
    expected_level: 3,
    candidate_level: null,
    provisional_level: null,
    ai_level: null,
    result: "not_assessed",
    delta: null,
    confidence: null,
    evidence_count: 0,
    is_override: false,
    ...overrides,
  };
}

describe("ComparisonTable", () => {
  // AC-21: the Required column must show the expected level for every row
  // — this is the exact bug (required_level vs expected_level) the revamp
  // set out to fix; it always rendered blank before.
  it("shows the required level for every row", () => {
    render(
      <ComparisonTable
        comparisons={[comparison({ skill_label: "React", expected_level: 4 })]}
      />
    );
    expect(screen.getByText("React").closest("tr")).toHaveTextContent("L4");
  });

  // AC-23: not_assessed never reads as a gap — no delta, no gap styling.
  it("renders a not_assessed skill as unscored, not as a gap", () => {
    render(
      <ComparisonTable
        comparisons={[
          comparison({ skill_label: "Cloud Infra", result: "not_assessed", expected_level: 3 }),
        ]}
      />
    );
    const row = screen.getByText("Cloud Infra").closest("tr")!;
    expect(row).toHaveTextContent("Not assessed");
    expect(row).not.toHaveTextContent("Gap");
    expect(row.textContent).not.toMatch(/-\d/); // no negative delta anywhere in the row
  });

  // AC-23: insufficient_evidence shows the provisional level, marked as
  // such, not scored as a real result.
  it("renders insufficient_evidence with its provisional level greyed out, not as a gap", () => {
    render(
      <ComparisonTable
        comparisons={[
          comparison({
            skill_label: "Testing",
            result: "insufficient_evidence",
            provisional_level: 2,
            expected_level: 3,
          }),
        ]}
      />
    );
    const row = screen.getByText("Testing").closest("tr")!;
    expect(row).toHaveTextContent("low evidence");
    expect(row).toHaveTextContent("Insufficient evidence");
    expect(row).not.toHaveTextContent("Gap");
  });

  it("renders match/gap/exceed with the real delta", () => {
    render(
      <ComparisonTable
        comparisons={[
          comparison({ skill_label: "A", result: "match", candidate_level: 3, expected_level: 3, delta: 0 }),
          comparison({ skill_label: "B", result: "gap", candidate_level: 1, expected_level: 3, delta: -2 }),
          comparison({ skill_label: "C", result: "exceed", candidate_level: 5, expected_level: 3, delta: 2 }),
        ]}
      />
    );
    expect(screen.getByText("A").closest("tr")).toHaveTextContent("Match");
    expect(screen.getByText("B").closest("tr")).toHaveTextContent("Gap");
    expect(screen.getByText("C").closest("tr")).toHaveTextContent("Exceeds");
  });

  // AC-22: an overridden row shows both the AI level and the assessor's
  // level, not just the final number with no provenance.
  it("shows AI level and assessor level together for an overridden row", () => {
    render(
      <ComparisonTable
        comparisons={[
          comparison({
            skill_label: "Cloud Infra",
            result: "match",
            ai_level: 1,
            candidate_level: 3,
            expected_level: 3,
            delta: 0,
            is_override: true,
          }),
        ]}
      />
    );
    const row = screen.getByText("Cloud Infra").closest("tr")!;
    expect(row).toHaveTextContent("AI L1");
    expect(row).toHaveTextContent("Assessor L3");
  });

  // AC-24: the summary banner appears only when something is actually
  // unassessed, and states the count honestly.
  it("shows the unassessed-count banner only when at least one skill needs it", () => {
    const { rerender } = render(
      <ComparisonTable
        comparisons={[comparison({ skill_label: "A", result: "match", candidate_level: 3, delta: 0 })]}
      />
    );
    expect(screen.queryByText(/could not be fully assessed/)).not.toBeInTheDocument();

    rerender(
      <ComparisonTable
        comparisons={[
          comparison({ skill_label: "A", result: "match", candidate_level: 3, delta: 0 }),
          comparison({ skill_label: "B", result: "not_assessed" }),
        ]}
      />
    );
    expect(screen.getByText(/1 of 2 skills could not be fully assessed/)).toBeInTheDocument();
  });

  it("shows confidence and evidence count for each row", () => {
    render(
      <ComparisonTable
        comparisons={[
          comparison({
            skill_label: "React",
            result: "match",
            candidate_level: 3,
            delta: 0,
            confidence: "high",
            evidence_count: 3,
          }),
        ]}
      />
    );
    const row = screen.getByText("React").closest("tr")!;
    expect(row).toHaveTextContent("high");
    expect(row).toHaveTextContent("3");
  });
});
