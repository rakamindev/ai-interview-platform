import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ComparisonTable from "./ComparisonTable";
import type { SkillComparison } from "@/types";

function makeComparison(overrides: Partial<SkillComparison> = {}): SkillComparison {
  return {
    skill_label: "React",
    expected_level: 3,
    candidate_level: 4,
    result: "match",
    delta: null,
    confidence: "high",
    ...overrides
  };
}

describe("ComparisonTable", () => {
  // AC-7.1 — Required column renders expected_level on every row via rail
  it("renders expected level in the Required column", () => {
    const comparisons = [makeComparison({ expected_level: 3 })];
    render(<ComparisonTable comparisons={comparisons} />);
    const cells = screen.getAllByRole("cell");
    const requiredCell = cells[1]; // second column
    // Rail renders required mark — aria-label mentions the level
    const rail = requiredCell.querySelector('[role="img"]');
    expect(rail).toBeInTheDocument();
    expect(rail!.getAttribute("aria-label")).toContain("L3");
  });

  it("renders fallback L-label when level not in LEVEL_LABELS", () => {
    const comparisons = [makeComparison({ expected_level: 6 })];
    render(<ComparisonTable comparisons={comparisons} />);
    const cells = screen.getAllByRole("cell");
    const rail = cells[1].querySelector('[role="img"]');
    expect(rail).toBeInTheDocument();
    expect(rail!.getAttribute("aria-label")).toContain("L6");
  });

  // AC-7.2 — Override provenance shown when is_override: true
  it("shows override provenance when is_override is true", () => {
    const comparisons = [
      makeComparison({
        is_override: true,
        override_actor: "assessor@example.com",
        override_reason: "Candidate demonstrated advanced skills in interview",
        override_at: "2025-01-15T10:30:00Z"
      })
    ];
    render(<ComparisonTable comparisons={comparisons} />);
    expect(screen.getByText("assessor@example.com")).toBeInTheDocument();
    expect(screen.getByText(/Candidate demonstrated advanced skills/)).toBeInTheDocument();
  });

  it("does not show provenance when is_override is false", () => {
    const comparisons = [
      makeComparison({
        is_override: false,
        override_actor: "assessor@example.com",
        override_reason: "Some reason"
      })
    ];
    render(<ComparisonTable comparisons={comparisons} />);
    expect(screen.queryByText("assessor@example.com")).not.toBeInTheDocument();
  });

  // AC-7.3 — Confidence visible on every row
  it("renders confidence dot on every row", () => {
    const comparisons = [
      makeComparison({ confidence: "high" }),
      makeComparison({ skill_label: "TypeScript", confidence: "medium" })
    ];
    render(<ComparisonTable comparisons={comparisons} />);
    expect(screen.getByText("high")).toBeInTheDocument();
    expect(screen.getByText("medium")).toBeInTheDocument();
  });

  it("does not render confidence dot when confidence is missing", () => {
    const comparisons = [makeComparison({ confidence: undefined })];
    render(<ComparisonTable comparisons={comparisons} />);
    // Should still have the cell but no dot text
    const cells = screen.getAllByRole("cell");
    expect(cells[3]).toHaveTextContent(""); // confidence column is empty
  });

  // AC-7.4 — insufficient_evidence rendered distinctly from gap
  it("renders insufficient_evidence with distinct label and icon", () => {
    const comparisons = [makeComparison({ result: "insufficient_evidence" })];
    render(<ComparisonTable comparisons={comparisons} />);
    expect(screen.getByText("Insufficient evidence")).toBeInTheDocument();
    expect(screen.queryByText("Gap")).not.toBeInTheDocument();
  });

  // AC-7.5 — exceed vs match visually distinguishable
  it("renders exceed and match with different labels", () => {
    const comparisons = [
      makeComparison({ skill_label: "React", result: "match" }),
      makeComparison({ skill_label: "TypeScript", result: "exceed", delta: 1 })
    ];
    render(<ComparisonTable comparisons={comparisons} />);
    expect(screen.getByText("Match")).toBeInTheDocument();
    expect(screen.getByText("Exceeds +1")).toBeInTheDocument();
  });

  // AC-7.6 — Level values rendered via rail aria-labels
  it("renders level as L3 format, never bare number", () => {
    const comparisons = [makeComparison({ expected_level: 3, candidate_level: 4 })];
    render(<ComparisonTable comparisons={comparisons} />);
    // Required rail mentions L3
    const cells = screen.getAllByRole("cell");
    const reqRail = cells[1].querySelector('[role="img"]');
    expect(reqRail!.getAttribute("aria-label")).toContain("L3");
    // Candidate rail mentions L4
    const candRail = cells[2].querySelector('[role="img"]');
    expect(candRail!.getAttribute("aria-label")).toContain("L4");
    // Ensure bare "3" is not rendered as standalone text in the first column
    expect(cells[0]).not.toHaveTextContent(/^3$/);
  });

  // AC-7.7 — Confidence not "low" must never be labelled "confirmed"
  it("never labels non-low confidence as confirmed", () => {
    const comparisons = [
      makeComparison({ confidence: "high" }),
      makeComparison({ skill_label: "TypeScript", confidence: "medium" })
    ];
    render(<ComparisonTable comparisons={comparisons} />);
    expect(screen.queryByText(/confirmed/i)).not.toBeInTheDocument();
    expect(screen.getByText("high")).toBeInTheDocument();
    expect(screen.getByText("medium")).toBeInTheDocument();
  });

  // Caption support
  it("renders caption when provided", () => {
    const comparisons = [makeComparison()];
    render(<ComparisonTable comparisons={comparisons} caption="Skill comparison summary" />);
    expect(screen.getByText("Skill comparison summary")).toBeInTheDocument();
  });

  // Summary counts
  it("renders summary counts for all result types", () => {
    const comparisons = [
      makeComparison({ skill_label: "React", result: "match" }),
      makeComparison({ skill_label: "TypeScript", result: "gap", delta: -1 }),
      makeComparison({ skill_label: "Testing", result: "exceed", delta: 1 }),
      makeComparison({ skill_label: "DevOps", result: "insufficient_evidence" })
    ];
    render(<ComparisonTable comparisons={comparisons} />);
    expect(screen.getByText("Match: 1")).toBeInTheDocument();
    expect(screen.getByText("Gap: 1")).toBeInTheDocument();
    expect(screen.getByText("Exceeds: 1")).toBeInTheDocument();
    expect(screen.getByText("Insufficient evidence: 1")).toBeInTheDocument();
  });
});

describe("ComparisonTable — anchor rail integration", () => {
  it("renders a rail in the Required column with required mark", () => {
    const comparisons = [makeComparison({ expected_level: 3 })];
    const { container } = render(<ComparisonTable comparisons={comparisons} />);
    const cells = screen.getAllByRole("cell");
    const requiredCell = cells[1];
    // Should contain a rail element (role=img)
    const rail = requiredCell.querySelector('[role="img"]');
    expect(rail).toBeInTheDocument();
    // Rail should have aria-label mentioning requirement
    expect(rail!.getAttribute("aria-label")).toContain("L3");
  });

  it("renders a rail in the Candidate column with both marks", () => {
    const comparisons = [makeComparison({ expected_level: 3, candidate_level: 4, confidence: "high" })];
    const { container } = render(<ComparisonTable comparisons={comparisons} />);
    const cells = screen.getAllByRole("cell");
    const candidateCell = cells[2];
    const rail = candidateCell.querySelector('[role="img"]');
    expect(rail).toBeInTheDocument();
    // Should mention both required and candidate levels
    expect(rail!.getAttribute("aria-label")).toContain("L3");
    expect(rail!.getAttribute("aria-label")).toContain("L4");
  });

  it("shows not_assessed dash in Candidate column when candidate_level is null", () => {
    const comparisons = [makeComparison({ candidate_level: null, result: "not_assessed" })];
    render(<ComparisonTable comparisons={comparisons} />);
    const cells = screen.getAllByRole("cell");
    const candidateCell = cells[2];
    expect(candidateCell).toHaveTextContent("—");
  });

  it("renders override indicator in Candidate cell when is_override is true", () => {
    const comparisons = [
      makeComparison({
        is_override: true,
        override_actor: "assessor@example.com",
        override_reason: "Manual override"
      })
    ];
    render(<ComparisonTable comparisons={comparisons} />);
    expect(screen.getByText("assessor@example.com")).toBeInTheDocument();
  });

  it("renders summary counts correctly with rails", () => {
    const comparisons = [
      makeComparison({ skill_label: "React", result: "match" }),
      makeComparison({ skill_label: "TypeScript", result: "gap", delta: -1 })
    ];
    render(<ComparisonTable comparisons={comparisons} />);
    expect(screen.getByText("Match: 1")).toBeInTheDocument();
    expect(screen.getByText("Gap: 1")).toBeInTheDocument();
  });
});
