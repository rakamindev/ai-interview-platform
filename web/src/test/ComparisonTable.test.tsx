import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import type { SkillComparison } from "@/types";

describe("ComparisonTable component", () => {
  const sampleComparisons: SkillComparison[] = [
    {
      skill_label: "React Architecture",
      required_level: 3,
      candidate_level: 3,
      result: "match",
      delta: 0,
    },
    {
      skill_label: "TypeScript Strict Mode",
      required_level: 3,
      candidate_level: 4,
      result: "exceed",
      delta: 1,
      is_override: true,
    },
    {
      skill_label: "Distributed Systems",
      required_level: 3,
      candidate_level: 2,
      result: "gap",
      delta: -1,
    },
    {
      skill_label: "DevOps & Kubernetes",
      required_level: 3,
      candidate_level: null as any,
      result: "not_assessed",
      delta: null as any,
    },
  ];

  it("renders all comparison skill labels and levels correctly", () => {
    render(<ComparisonTable comparisons={sampleComparisons} />);

    expect(screen.getByText("React Architecture")).toBeInTheDocument();
    expect(screen.getByText("TypeScript Strict Mode")).toBeInTheDocument();
    expect(screen.getByText("Distributed Systems")).toBeInTheDocument();
    expect(screen.getByText("DevOps & Kubernetes")).toBeInTheDocument();
  });

  it("renders executive summary metric counts", () => {
    render(<ComparisonTable comparisons={sampleComparisons} />);

    // 1 match, 1 exceed, 1 gap, 1 unassessed
    expect(screen.getByText("Matches")).toBeInTheDocument();
    expect(screen.getByText("Exceeds")).toBeInTheDocument();
    expect(screen.getByText("Gaps")).toBeInTheDocument();
    expect(screen.getAllByText("Not Evaluated")[0]).toBeInTheDocument();
  });

  it("handles unassessed skills gracefully without crashing or defaulting to zero", () => {
    render(<ComparisonTable comparisons={sampleComparisons} />);

    expect(screen.getAllByText("Not Evaluated").length).toBe(2); // Card metric & table cell
    expect(screen.getByText("Not Assessed")).toBeInTheDocument();
    expect(screen.getByText(/require follow-up evaluation/i)).toBeInTheDocument();
  });

  it("indicates human assessor override icon when is_override is true", () => {
    render(<ComparisonTable comparisons={sampleComparisons} />);

    expect(screen.getByTitle("Human assessor override applied")).toBeInTheDocument();
  });
});
