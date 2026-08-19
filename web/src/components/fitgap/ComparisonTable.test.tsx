import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ComparisonTable from "./ComparisonTable";
import type { SkillComparison } from "@/types";

describe("ComparisonTable", () => {
  it("renders a match with no delta suffix", () => {
    const comparisons: SkillComparison[] = [
      { skill_label: "Ruby", expected_level: 3, candidate_level: 3, result: "match" },
    ];
    render(<ComparisonTable comparisons={comparisons} />);

    expect(screen.getByText("Ruby")).toBeInTheDocument();
    expect(screen.getByText(/✅ Match: 1 skill/)).toBeInTheDocument();
  });

  it("renders a gap with a negative delta suffix", () => {
    const comparisons: SkillComparison[] = [
      { skill_label: "Kubernetes", expected_level: 4, candidate_level: 2, result: "gap", delta: -2 },
    ];
    render(<ComparisonTable comparisons={comparisons} />);

    expect(screen.getByText(/Gap -2/)).toBeInTheDocument();
    expect(screen.getByText(/⚠ Gap: 1 skill/)).toBeInTheDocument();
  });

  it("renders an exceed with a positive delta suffix", () => {
    const comparisons: SkillComparison[] = [
      { skill_label: "React", expected_level: 2, candidate_level: 4, result: "exceed", delta: 2 },
    ];
    render(<ComparisonTable comparisons={comparisons} />);

    expect(screen.getByText(/Exceeds \+2/)).toBeInTheDocument();
  });

  it("renders a dash for candidate level and no delta suffix when not assessed", () => {
    const comparisons: SkillComparison[] = [
      { skill_label: "Terraform", expected_level: 3, result: "not_assessed" },
    ];
    render(<ComparisonTable comparisons={comparisons} />);

    expect(screen.getByText(/Not assessed/)).toBeInTheDocument();
    // Not assessed shouldn't be counted in the match/gap/exceed summary line at the bottom.
    expect(screen.queryByText(/✅ Match/)).not.toBeInTheDocument();
    expect(screen.queryByText(/⚠ Gap/)).not.toBeInTheDocument();
  });

  it("shows the human-override marker only when is_override is true", () => {
    const comparisons: SkillComparison[] = [
      { skill_label: "Ruby", expected_level: 3, candidate_level: 4, result: "exceed", delta: 1, is_override: true },
    ];
    render(<ComparisonTable comparisons={comparisons} />);

    expect(screen.getByTitle("Human override applied")).toBeInTheDocument();
  });
});
