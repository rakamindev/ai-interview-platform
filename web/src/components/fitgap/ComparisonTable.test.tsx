import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ComparisonTable from "./ComparisonTable";
import type { SkillComparison } from "@/types";

describe("ComparisonTable Component", () => {
  it("renders empty state when comparisons array is empty", () => {
    render(<ComparisonTable comparisons={[]} />);
    expect(screen.getByText("No skills compared in this report.")).toBeInTheDocument();
  });

  it("renders both required_level and fallback expected_level correctly", () => {
    const comparisons: SkillComparison[] = [
      {
        skill_label: "React",
        expected_level: 3,
        candidate_level: 3,
        result: "match",
        delta: 0,
      },
      {
        skill_label: "Ruby on Rails",
        required_level: 4,
        candidate_level: 2,
        result: "gap",
        delta: -2,
      },
    ];

    render(<ComparisonTable comparisons={comparisons} />);

    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("Ruby on Rails")).toBeInTheDocument();

    // Verify levels render without blank cells
    expect(screen.getAllByText("L3").length).toBeGreaterThan(0);
    expect(screen.getAllByText("L4").length).toBeGreaterThan(0);
    expect(screen.getAllByText("L2").length).toBeGreaterThan(0);
  });

  it("renders human assessor override badge and details when is_override is true", () => {
    const comparisons: SkillComparison[] = [
      {
        skill_label: "Distributed Architecture",
        expected_level: 3,
        candidate_level: 4,
        result: "exceed",
        delta: 1,
        is_override: true,
        ai_level: 2,
        override_level: 4,
        assessor_notes: "Deep understanding of Paxos/Raft consensus",
      },
    ];

    render(<ComparisonTable comparisons={comparisons} />);

    const overrideBadge = screen.getByText(/✏ Override/i);
    expect(overrideBadge).toBeInTheDocument();
    expect(overrideBadge).toHaveAttribute(
      "title",
      expect.stringContaining("Paxos/Raft consensus")
    );
    expect(screen.getByText(/1 human override applied/i)).toBeInTheDocument();
  });
});
