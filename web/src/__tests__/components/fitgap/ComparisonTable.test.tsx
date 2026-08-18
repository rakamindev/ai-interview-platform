import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import type { SkillComparison } from "@/types";

describe("ComparisonTable", () => {
  it("renders expected_level as L3 when expected_level=3", () => {
    const comparisons: SkillComparison[] = [
      {
        skill_label: "React",
        expected_level: 3,
        candidate_level: 4,
        result: "exceed",
        delta: 1,
      },
    ];

    render(<ComparisonTable comparisons={comparisons} />);
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("L3")).toBeInTheDocument();
    expect(screen.getByText("L4")).toBeInTheDocument();
  });

  it("renders '—' and not_assessed count when expected_level or candidate_level is missing", () => {
    const comparisons: SkillComparison[] = [
      {
        skill_label: "GraphQL",
        expected_level: 3,
        candidate_level: undefined,
        result: "not_assessed",
      },
    ];

    render(<ComparisonTable comparisons={comparisons} />);
    expect(screen.getByText("GraphQL")).toBeInTheDocument();
    expect(screen.getByText("— Not assessed: 1 skill")).toBeInTheDocument();
  });
});
