import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ComparisonTable from "./ComparisonTable";
import type { SkillComparison } from "@/types";

describe("ComparisonTable", () => {
  it("renders empty state when no comparisons are provided", () => {
    render(<ComparisonTable comparisons={[]} />);
    expect(screen.getByText("No skill comparisons available.")).toBeDefined();
  });

  it("renders skill comparison rows with required and candidate levels (BUG-01)", () => {
    const comparisons: SkillComparison[] = [
      {
        skill_label: "PostgreSQL",
        expected_level: 3,
        required_level: 3,
        candidate_level: 3,
        delta: 0,
        result: "match",
        is_override: false,
      },
    ];

    render(<ComparisonTable comparisons={comparisons} />);
    expect(screen.getByText("PostgreSQL")).toBeDefined();
    expect(screen.getAllByText("L3").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Match/).length).toBeGreaterThanOrEqual(1);
  });

  it("surfaces the Override indicator when assessor has overridden the level (BUG-02)", () => {
    const comparisons: SkillComparison[] = [
      {
        skill_label: "Node.js",
        expected_level: 3,
        required_level: 3,
        candidate_level: 4,
        delta: 1,
        result: "exceed",
        is_override: true,
      },
    ];

    render(<ComparisonTable comparisons={comparisons} />);
    expect(screen.getByText("Node.js")).toBeDefined();
    expect(screen.getByTitle("Human override applied")).toBeDefined();
    expect(screen.getByText("✏")).toBeDefined();
  });
});
