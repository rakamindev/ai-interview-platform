import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ComparisonTable from "./ComparisonTable";
import type { SkillComparison } from "@/types";

const assessed: SkillComparison = {
  vacancy_skill_id: 1,
  skill_id: "react",
  skill_label: "React",
  expected_level: 3,
  candidate_level: 4,
  delta: 1,
  result: "exceed",
  is_override: true,
  rating_source: "assessor",
  confidence: "high",
  reason: null,
  portfolio_skill_id: 8,
};
const missing: SkillComparison = {
  ...assessed,
  vacancy_skill_id: 2,
  skill_label: "System design",
  candidate_level: null,
  delta: null,
  result: "not_assessed",
  is_override: false,
  rating_source: null,
  confidence: null,
  reason: "missing_skill",
};

describe("ComparisonTable", () => {
  it("renders required and assessed levels using the API contract and names human provenance", () => {
    render(<ComparisonTable comparisons={[assessed]} />);
    expect(screen.getByText("L3")).toBeVisible();
    expect(screen.getByText("L4")).toBeVisible();
    expect(screen.getByText("Assessor override")).toBeVisible();
    expect(screen.getByText("Above requirement")).toBeVisible();
  });

  it("keeps missing assessment visible with a follow-up explanation", () => {
    render(<ComparisonTable comparisons={[missing]} />);
    expect(screen.getAllByText("Not assessed").length).toBe(2);
    expect(screen.getByText(/This skill was not assessed/)).toBeVisible();
    expect(screen.queryByText("Below requirement")).not.toBeInTheDocument();
  });

  it("filters to gaps, unknowns, and low-confidence ratings without losing counts", async () => {
    const user = userEvent.setup();
    render(
      <ComparisonTable
        comparisons={[
          assessed,
          missing,
          {
            ...assessed,
            vacancy_skill_id: 3,
            skill_label: "Testing",
            rating_source: "ai",
            is_override: false,
            confidence: "low",
          },
        ]}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Needs follow-up (2)" }),
    );
    expect(screen.queryByText("React")).not.toBeInTheDocument();
    expect(screen.getByText("System design")).toBeVisible();
    expect(screen.getByText("Testing")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "All (3)" }));
    expect(screen.getByText("React")).toBeVisible();
  });

  it("keeps historical AI confidence from overruling an assessor rating", async () => {
    const user = userEvent.setup();
    render(
      <ComparisonTable comparisons={[{ ...assessed, confidence: "low" }]} />,
    );
    expect(screen.getByText("AI confidence: low")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Needs follow-up (0)" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "No skills need follow-up",
    );
  });

  it("explains empty configuration without implying a candidate match", () => {
    render(<ComparisonTable comparisons={[]} />);
    expect(screen.getByText("No skill requirements configured")).toBeVisible();
    expect(
      screen.getByText(/empty report does not indicate a match/),
    ).toBeVisible();
  });
});
