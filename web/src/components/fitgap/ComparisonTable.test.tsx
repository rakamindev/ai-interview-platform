import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ComparisonTable from "./ComparisonTable";
import type { SkillComparison } from "@/types";

describe("ComparisonTable (Fit/Gap Breakdown)", () => {
  const sampleComparisons: SkillComparison[] = [
    {
      skill_label: "React / Frontend Development Core",
      required_level: 4,
      candidate_level: 4,
      result: "match",
      delta: 0,
    },
    {
      skill_label: "System Design & Architecture",
      required_level: 4,
      candidate_level: 3,
      result: "gap",
      delta: -1,
    },
    {
      skill_label: "Cloud Infrastructure",
      required_level: 3,
      candidate_level: 4,
      result: "exceed",
      delta: 1,
    },
  ];

  it("renders comparison rows for all skills", () => {
    render(<ComparisonTable comparisons={sampleComparisons} />);

    expect(screen.getByText("React / Frontend Development Core")).toBeInTheDocument();
    expect(screen.getByText("System Design & Architecture")).toBeInTheDocument();
    expect(screen.getByText("Cloud Infrastructure")).toBeInTheDocument();
  });

  it("displays summary counts of match, gap, and exceed", () => {
    render(<ComparisonTable comparisons={sampleComparisons} />);

    expect(screen.getByText(/Match: 1 skill/i)).toBeInTheDocument();
    expect(screen.getByText(/Gap: 1 skill/i)).toBeInTheDocument();
    expect(screen.getByText(/Exceeds: 1 skill/i)).toBeInTheDocument();
  });

  it("handles backend expected_level / actual_level field fallbacks safely", () => {
    const rawBackendPayload = [
      {
        skill_label: "TypeScript",
        expected_level: 3,
        actual_level: 3,
        fit_result: "match",
      } as any,
    ];

    render(<ComparisonTable comparisons={rawBackendPayload} />);
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("L3", { selector: "td" })).toBeInTheDocument();
  });
});
