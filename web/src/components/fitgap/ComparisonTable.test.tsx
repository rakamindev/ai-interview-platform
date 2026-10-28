import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import ComparisonTable from "./ComparisonTable";
import type { SkillComparison } from "@/types";

afterEach(() => cleanup());

const comparisons: SkillComparison[] = [
  {
    skill_id: "skill-react",
    skill_label: "React",
    required_level: 3,
    candidate_level: 4,
    result: "exceed",
    delta: 1,
    confidence: "high",
    is_override: true,
  },
  {
    skill_id: "skill-ruby",
    skill_label: "Ruby",
    required_level: 4,
    candidate_level: 2,
    result: "gap",
    delta: -2,
    confidence: "medium",
    is_override: false,
  },
  {
    skill_id: "skill-sql",
    skill_label: "SQL",
    required_level: 2,
    candidate_level: null,
    result: "not_assessed",
    delta: null,
    confidence: null,
    is_override: false,
  },
];

describe("ComparisonTable", () => {
  it("renders required and candidate levels with the assessor override marker", () => {
    render(<ComparisonTable comparisons={comparisons} />);
    const row = screen.getByRole("row", { name: /React/ });

    expect(within(row).getByText("L3")).toBeTruthy();
    expect(within(row).getByText("L4")).toBeTruthy();
    expect(within(row).getByText("Assessor override applied")).toBeTruthy();
    expect(within(row).getByText(/Exceeds \+1/)).toBeTruthy();
  });

  it("keeps an unassessed skill distinct from a gap", () => {
    render(<ComparisonTable comparisons={comparisons} />);
    const row = screen.getByRole("row", { name: /SQL/ });

    expect(within(row).getAllByText("Not assessed")).toHaveLength(2);
    expect(within(row).queryByText("Gap")).toBeNull();
    expect(within(row).getByText("L2")).toBeTruthy();
  });

  it("shows a useful empty state instead of an empty table", () => {
    render(<ComparisonTable comparisons={[]} />);

    expect(screen.getByText("No skill requirements to compare")).toBeTruthy();
    expect(screen.getByText(/Add skills to the vacancy/)).toBeTruthy();
  });

  it("summarizes all result categories without hiding zero counts", () => {
    render(<ComparisonTable comparisons={comparisons} />);

    expect(screen.getByText("Match")).toBeTruthy();
    expect(screen.getByText("Gap")).toBeTruthy();
    expect(screen.getByText("Exceeds")).toBeTruthy();
    expect(screen.getAllByText("Not assessed").length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText("0")).toBeTruthy();
    expect(screen.getAllByText("1")).toHaveLength(3);
  });
});
