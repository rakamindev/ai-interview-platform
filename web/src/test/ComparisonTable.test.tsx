import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import type { SkillComparison } from "@/types";

describe("ComparisonTable component", () => {
  it("renders comparisons with required_level or expected_level and override marker", () => {
    const comparisons: SkillComparison[] = [
      {
        skill_label: "React / Frontend Development",
        expected_level: 3,
        candidate_level: 4,
        result: "exceed",
        delta: 1,
        is_override: true,
      },
      {
        skill_label: "Node.js / Backend Development",
        required_level: 4,
        candidate_level: undefined,
        result: "not_assessed",
      },
      {
        skill_label: "System Architecture",
        required_level: 3,
        candidate_level: 2,
        result: "gap",
        delta: -1,
      },
    ];

    render(<ComparisonTable comparisons={comparisons} />);

    // Assert table headers
    expect(screen.getByText("Skill")).toBeInTheDocument();
    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(screen.getByText("Candidate")).toBeInTheDocument();

    // Assert rows
    expect(screen.getByText("React / Frontend Development")).toBeInTheDocument();
    expect(screen.getByText("Node.js / Backend Development")).toBeInTheDocument();
    expect(screen.getByText("System Architecture")).toBeInTheDocument();

    // Assert override pencil indicator
    expect(screen.getByText("✏")).toBeInTheDocument();

    // Assert summary badges count
    expect(screen.getByText(/Exceeds: 1 skill/)).toBeInTheDocument();
    expect(screen.getByText(/Gap: 1 skill/)).toBeInTheDocument();
  });
});
