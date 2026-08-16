import { render, screen } from "@testing-library/react";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import type { SkillComparison } from "@/types";

const comparisons: SkillComparison[] = [
  {
    skill_label: "React",
    expected_level: 3,
    candidate_level: 3,
    result: "match",
    delta: 0,
    is_override: false,
  },
  {
    skill_label: "TypeScript",
    expected_level: 4,
    candidate_level: null,
    result: "not_assessed",
    delta: null,
    is_override: false,
  },
];

describe("ComparisonTable", () => {
  it("shows expected_level in the Required column", () => {
    render(<ComparisonTable comparisons={comparisons} />);
    const headers = screen.getAllByRole("columnheader");
    expect(headers.map((h) => h.textContent)).toContain("Required");
    expect(screen.getByText("L4")).toBeInTheDocument();
    expect(screen.getAllByText("L3").length).toBeGreaterThanOrEqual(1);
  });

  it("counts not_assessed in summary", () => {
    render(<ComparisonTable comparisons={comparisons} />);
    expect(screen.getByText(/Not assessed: 1/)).toBeInTheDocument();
  });

  it("shows em dash for missing candidate level", () => {
    render(<ComparisonTable comparisons={comparisons} />);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
});
