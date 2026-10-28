import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import ComparisonTable from "../ComparisonTable";
import type { SkillComparison } from "@/types";

describe("ComparisonTable Component", () => {
  const sampleComparisons: SkillComparison[] = [
    {
      skill_label: "Ruby on Rails",
      required_level: 3,
      candidate_level: 3,
      result: "match",
      delta: 0,
      is_override: false,
    },
    {
      skill_label: "PostgreSQL",
      required_level: 2,
      candidate_level: 4,
      result: "exceed",
      delta: 2,
      is_override: true,
    },
    {
      skill_label: "Docker",
      required_level: 3,
      candidate_level: 1,
      result: "gap",
      delta: -2,
      is_override: false,
    },
    {
      skill_label: "Kubernetes",
      required_level: 2,
      candidate_level: undefined,
      result: "not_assessed",
      delta: undefined,
      is_override: false,
    },
  ];

  it("renders comparisons with Lucide icons and no raw emojis", () => {
    const { container } = render(<ComparisonTable comparisons={sampleComparisons} />);

    // Should render table and rows
    expect(screen.getByTestId("comparison-table")).toBeInTheDocument();
    expect(screen.getByText("Ruby on Rails")).toBeInTheDocument();
    expect(screen.getByText("PostgreSQL")).toBeInTheDocument();
    expect(screen.getByText("Docker")).toBeInTheDocument();
    expect(screen.getByText("Kubernetes")).toBeInTheDocument();

    // Verify badges for each result type exist
    expect(screen.getByTestId("result-badge-match")).toBeInTheDocument();
    expect(screen.getByTestId("result-badge-exceed")).toBeInTheDocument();
    expect(screen.getByTestId("result-badge-gap")).toBeInTheDocument();
    expect(screen.getByTestId("result-badge-not_assessed")).toBeInTheDocument();

    // Ensure raw emojis are absent
    expect(container.textContent).not.toContain("✅");
    expect(container.textContent).not.toContain("⭐");
    expect(container.textContent).not.toContain("⚠");
    expect(container.textContent).not.toContain("✏");
  });

  it("renders summary bar with explicit counter for not_assessed skills", () => {
    render(<ComparisonTable comparisons={sampleComparisons} />);

    expect(screen.getByTestId("comparison-summary")).toBeInTheDocument();
    expect(screen.getByText(/Match: 1 skill/i)).toBeInTheDocument();
    expect(screen.getByText(/Gap: 1 skill/i)).toBeInTheDocument();
    expect(screen.getByText(/Exceeds: 1 skill/i)).toBeInTheDocument();

    // Not assessed count must be explicit
    const notAssessedSummary = screen.getByTestId("summary-not-assessed");
    expect(notAssessedSummary).toBeInTheDocument();
    expect(notAssessedSummary).toHaveTextContent("Belum dinilai: 1 skill");
  });
});
