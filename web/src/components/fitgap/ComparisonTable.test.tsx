import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ComparisonTable from "./ComparisonTable";
import type { SkillComparison } from "@/types";

const unassessed: SkillComparison = {
  skill_id: "SK-ENG-001",
  skill_label: "React",
  required_level: 3,
  candidate_level: null,
  result: "not_assessed",
  delta: null,
  is_override: false,
  assessment_state: "insufficient_evidence",
  evidence_count: 1,
  reason: "Fewer than two verified candidate quotes or insufficient probing",
};

describe("ComparisonTable", () => {
  it("keeps insufficient evidence visible without inventing a candidate level or gap", () => {
    render(<ComparisonTable comparisons={[unassessed]} />);

    expect(screen.getAllByText(/Not assessed/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Needs assessment: 1/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1 verified quote/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Gap: 1/)).toBeNull();
    expect(screen.queryByText(/L1/)).toBeNull();
  });

  it("explains an empty vacancy instead of rendering a blank comparison", () => {
    render(<ComparisonTable comparisons={[]} />);
    expect(screen.getByText(/no skills configured yet/i)).toBeTruthy();
  });

  it("links a compared skill to its portfolio evidence", () => {
    render(<ComparisonTable comparisons={[{ ...unassessed, portfolio_skill_id: 42 }]}
      portfolioPath="/assessments/4/sessions/7/portfolio" />);

    const links = screen.getAllByRole("link", { name: "Review portfolio evidence" });
    expect(links[0].getAttribute("href")).toBe("/assessments/4/sessions/7/portfolio#skill-42");
  });
});
