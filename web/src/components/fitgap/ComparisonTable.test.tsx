import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { SkillComparison } from "@/types";
import ComparisonTable from "./ComparisonTable";

// Rows in the shape FitGap::Engine stores them (expected_level, not required_level).
const rows = [
  { skill_label: "React", candidate_level: 3, expected_level: 3, result: "match", delta: 0 },
  { skill_label: "Communication", candidate_level: 2, expected_level: 3, result: "gap", delta: -1 },
  { skill_label: "System Design", candidate_level: 3, expected_level: 2, result: "exceed", delta: 1, is_override: true },
  { skill_label: "Testing", candidate_level: null, expected_level: 2, result: "not_assessed", delta: null,
    not_assessed_reason: "not_reached" },
] as unknown as SkillComparison[];

// The skill cell starts with the label; a skill that wasn't assessed also says why (AC-25).
function cells(label: string) {
  const cell = screen.getByRole("cell", { name: new RegExp(`^${label}`) });
  return within(cell.closest("tr") as HTMLElement).getAllByRole("cell");
}

describe("ComparisonTable", () => {
  it("shows the candidate's level and the result with its delta for each skill", () => {
    render(<ComparisonTable comparisons={rows} />);

    expect(cells("React")[3]).toHaveTextContent("Match");
    expect(cells("Communication")[2]).toHaveTextContent("L2");
    expect(cells("Communication")[3]).toHaveTextContent("Gap -1");
    expect(cells("System Design")[3]).toHaveTextContent("Exceeds +1");
  });

  it("marks a level the assessor overrode", () => {
    render(<ComparisonTable comparisons={rows} />);

    expect(cells("System Design")[2]).toHaveTextContent("✏");
    expect(cells("React")[2]).not.toHaveTextContent("✏");
  });

  it("shows a dash, not a level, for a skill that wasn't assessed", () => {
    render(<ComparisonTable comparisons={rows} />);

    expect(cells("Testing")[2]).toHaveTextContent("—");
    expect(cells("Testing")[3]).toHaveTextContent("Not assessed");
  });

  it("summarises how many skills match, fall short and exceed", () => {
    render(<ComparisonTable comparisons={rows} />);

    expect(screen.getByText(/Match: 1 skill$/)).toBeInTheDocument();
    expect(screen.getByText(/Gap: 1 skill$/)).toBeInTheDocument();
    expect(screen.getByText(/Exceeds: 1 skill$/)).toBeInTheDocument();
  });

  it("renders an empty table without failing", () => {
    render(<ComparisonTable comparisons={[]} />);

    expect(screen.getAllByRole("row")).toHaveLength(1);
  });

  it("AC-25: says why a skill wasn't assessed and suggests probing it next", () => {
    render(<ComparisonTable comparisons={rows} />);

    expect(cells("Testing")[0]).toHaveTextContent("Not reached before the interview ended");
    expect(cells("Testing")[0]).toHaveTextContent("probe it in the next interview");
  });

  it("AC-25: says when the vacancy asks for a skill this interview didn't cover", () => {
    const row = { ...rows[3], skill_label: "Kubernetes", not_assessed_reason: "not_in_assessment" } as SkillComparison;
    render(<ComparisonTable comparisons={[row]} />);

    expect(cells("Kubernetes")[0]).toHaveTextContent("Not part of this interview");
  });

  it("AC-29: labels each value, so the rows still read when stacked on a phone", () => {
    render(<ComparisonTable comparisons={rows} />);

    expect(cells("Communication")[1]).toHaveAttribute("data-label", "Required");
    expect(cells("Communication")[2]).toHaveAttribute("data-label", "Candidate");
  });

  describe("known defects", () => {
    it("P1-2: shows the level the vacancy requires", () => {
      render(<ComparisonTable comparisons={rows} />);

      expect(cells("Communication")[1]).toHaveTextContent("L3");
    });

    it("P2-5: counts skills that weren't assessed in the summary", () => {
      render(<ComparisonTable comparisons={rows} />);

      expect(screen.getByText(/Not assessed: 1 skill/)).toBeInTheDocument();
    });
  });
});
