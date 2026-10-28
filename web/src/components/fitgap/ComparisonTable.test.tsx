import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import ComparisonTable from "./ComparisonTable";
import type { SkillComparison } from "@/types";

function comparison(overrides: Partial<SkillComparison> = {}): SkillComparison {
  return {
    skill_label: "React",
    expected_level: 3,
    candidate_level: 3,
    result: "match",
    delta: 0,
    is_override: false,
    ...overrides,
  };
}

function rowFor(label: string) {
  return screen.getByText(label).closest("tr") as HTMLElement;
}

describe("ComparisonTable", () => {
  it("shows the required level coming from the API field expected_level", () => {
    render(<ComparisonTable comparisons={[comparison({ expected_level: 4, candidate_level: 2, result: "gap", delta: -2 })]} />);

    const row = within(rowFor("React"));
    expect(row.getByText("L4")).toBeTruthy(); // Required
    expect(row.getByText("L2")).toBeTruthy(); // Candidate
  });

  it("shows a skill that was not assessed as 'Not assessed', never as a level", () => {
    render(
      <ComparisonTable
        comparisons={[comparison({ skill_label: "RESTful API Design", candidate_level: null, result: "not_assessed", delta: null })]}
      />
    );

    const row = within(rowFor("RESTful API Design"));
    expect(row.getByText("Not assessed")).toBeTruthy();
    expect(row.queryByText("L1")).toBeNull();
  });

  it("marks a level that was changed by an assessor", () => {
    render(<ComparisonTable comparisons={[comparison({ is_override: true })]} />);

    expect(within(rowFor("React")).getByText("✏")).toBeTruthy();
  });

  it("does not mark a level that was not changed", () => {
    render(<ComparisonTable comparisons={[comparison({ is_override: false })]} />);

    expect(within(rowFor("React")).queryByText("✏")).toBeNull();
  });

  it("counts not-assessed skills in the summary", () => {
    render(
      <ComparisonTable
        comparisons={[
          comparison(),
          comparison({ skill_label: "Testing", candidate_level: null, result: "not_assessed", delta: null }),
        ]}
      />
    );

    expect(screen.getByText(/Not assessed: 1 skill/)).toBeTruthy();
  });
});
