import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import type { SkillComparison } from "@/types";

const base: SkillComparison = { skill_label: "React", required_level: 3, candidate_level: 3, result: "match", delta: 0 };

describe("ComparisonTable", () => {
  it("shows the required level (regression: the column read a key the API never sent)", () => {
    render(<ComparisonTable comparisons={[{ ...base, required_level: 4, candidate_level: 2, result: "gap", delta: -2 }]} />);
    const item = screen.getByRole("listitem");
    expect(within(item).getByText("L4")).toBeInTheDocument();
    expect(item).not.toHaveTextContent("undefined");
  });

  it("falls back to legacy expected_level payloads", () => {
    const legacy = { skill_label: "SQL", expected_level: 5, candidate_level: 5, result: "match" } as unknown as SkillComparison;
    render(<ComparisonTable comparisons={[legacy]} />);
    expect(screen.getAllByText("L5").length).toBeGreaterThan(0);
  });

  it("explains a not-assessed skill as unknown rather than failed", () => {
    render(<ComparisonTable comparisons={[{ ...base, candidate_level: null, result: "not_assessed", delta: null }]} />);
    expect(screen.getByText("Not assessed").closest("span")).toHaveAttribute("title", expect.stringContaining("not a weakness"));
  });

  it("marks a low-evidence gap as verify instead of a firm gap", () => {
    render(<ComparisonTable comparisons={[{ ...base, candidate_level: 1, result: "gap", delta: -2, low_evidence: true }]} />);
    expect(screen.getByText(/Gap · verify/)).toBeInTheDocument();
  });

  it("flags assessor overrides accessibly", () => {
    render(<ComparisonTable comparisons={[{ ...base, is_override: true, ai_level: 2 }]} />);
    expect(screen.getByText("Adjusted by an assessor")).toBeInTheDocument();
  });

  it("lists gaps before matches", () => {
    render(
      <ComparisonTable
        comparisons={[
          { ...base, skill_label: "Match skill" },
          { ...base, skill_label: "Gap skill", result: "gap", candidate_level: 1, delta: -2 },
        ]}
      />
    );
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Gap skill");
  });

  it("renders a very long skill label without losing it", () => {
    const long = "Distributed systems architecture and ".repeat(8).trim();
    render(<ComparisonTable comparisons={[{ ...base, skill_label: long }]} />);
    expect(screen.getByText(long)).toHaveClass("break-words");
  });

  it("shows a helpful empty state when the vacancy has no skills", () => {
    render(<ComparisonTable comparisons={[]} />);
    expect(screen.getByText(/lists no required skills/)).toBeInTheDocument();
  });
});
