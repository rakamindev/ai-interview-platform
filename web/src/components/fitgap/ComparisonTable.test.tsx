import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ComparisonTable from "./ComparisonTable";
import type { SkillComparison } from "@/types";

const comparisons: SkillComparison[] = [
  {
    skill_label: "React",
    skill_id: "react",
    expected_level: 3,
    candidate_level: 2,
    result: "gap",
    delta: -1,
    confidence: "high",
    is_override: false,
    caveat: null,
  },
  {
    skill_label: "Communication",
    skill_id: "communication",
    expected_level: 3,
    candidate_level: null,
    result: "not_assessed",
    delta: null,
    confidence: null,
    is_override: false,
    caveat: "No usable evidence",
  },
];

describe("ComparisonTable", () => {
  it("renders expected, candidate, result, and delta values", () => {
    render(<ComparisonTable comparisons={comparisons} />);

    expect(screen.getAllByText("React").length).toBeGreaterThan(0);
    expect(screen.getAllByText("L3").length).toBeGreaterThan(0);
    expect(screen.getAllByText("L2").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Gap -1/).length).toBeGreaterThan(0);
  });

  it("renders not-assessed caveat in responsive representations", () => {
    render(<ComparisonTable comparisons={comparisons} />);

    expect(screen.getAllByText("Communication").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Not assessed/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("No usable evidence").length).toBeGreaterThan(0);
  });

  it("renders an empty table without crashing", () => {
    render(<ComparisonTable comparisons={[]} />);

    expect(screen.queryByText("React")).not.toBeInTheDocument();
    expect(screen.queryByText("Match:")).not.toBeInTheDocument();
  });

  it("marks override provenance in desktop and mobile representations", () => {
    const overridden: SkillComparison[] = [
      {
        skill_label: "React",
        skill_id: "react",
        expected_level: 3,
        candidate_level: 3,
        result: "match",
        delta: 0,
        confidence: "high",
        is_override: true,
        caveat: null,
      },
    ];

    render(<ComparisonTable comparisons={overridden} />);

    expect(screen.getAllByText("✏").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/· human/).length).toBeGreaterThan(0);
  });

  it("renders mobile skill cards with required and candidate levels", () => {
    render(<ComparisonTable comparisons={comparisons} />);

    expect(screen.getAllByText(/Required:/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Candidate:/).length).toBeGreaterThan(0);
  });
});
