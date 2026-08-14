import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import type { SkillComparison } from "@/types";

describe("ComparisonTable", () => {
  const comparisons: SkillComparison[] = [
    {
      skill_label: "Node.js / Backend Development",
      expected_level: 3,
      candidate_level: 4,
      result: "exceed",
      delta: 1,
    },
    {
      skill_label: "Communication",
      expected_level: 3,
      candidate_level: 2,
      result: "gap",
      delta: -1,
    },
    {
      skill_label: "Micro-frontends",
      expected_level: 2,
      candidate_level: undefined,
      result: "not_assessed",
    },
  ];

  it("renders the required level from expected_level (contract fix)", () => {
    render(<ComparisonTable comparisons={comparisons} />);
    expect(screen.getByRole("columnheader", { name: "Required" })).toBeInTheDocument();
    expect(screen.getAllByText("L3").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("L2").length).toBeGreaterThanOrEqual(1);
  });

  it("renders match/gap/exceed badges and not-assessed dash", () => {
    render(<ComparisonTable comparisons={comparisons} />);
    expect(screen.getAllByText(/Exceeds/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Gap/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Not assessed/).length).toBeGreaterThan(0);
  });
});
