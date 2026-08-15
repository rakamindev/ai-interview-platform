import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ComparisonTable from "../ComparisonTable";
import type { SkillComparison } from "@/types";

function comparison(overrides: Partial<SkillComparison> = {}): SkillComparison {
  return {
    skill_label: "Distributed Systems",
    skill_id: "sk-eng-001",
    required_level: 3,
    expected_level: 3,
    candidate_level: 3,
    ai_level: 3,
    override_level: null,
    is_override: false,
    confidence: "high",
    assessment_state: "assessed",
    result: "match",
    delta: 0,
    in_vacancy: true,
    ...overrides,
  };
}

const table = () => screen.getByRole("table");

describe("ComparisonTable", () => {
  // This column was blank on every row for as long as the feature existed.
  it("renders the required level, the column the API contract bug left empty", () => {
    render(<ComparisonTable comparisons={[comparison()]} />);

    const row = within(table()).getAllByRole("row")[1];
    expect(within(row).getAllByText("L3").length).toBeGreaterThan(0);
  });

  it("shows where a rating came from when an assessor overrode it", () => {
    render(
      <ComparisonTable
        comparisons={[comparison({ is_override: true, ai_level: 2, override_level: 4, candidate_level: 4, result: "exceed", delta: 1 })]}
      />,
    );

    const row = within(table()).getAllByRole("row")[1];
    expect(within(row).getByText("L2")).toBeInTheDocument();
    expect(within(row).getByText("L4")).toBeInTheDocument();
    expect(within(row).getByText("your rating")).toBeInTheDocument();
  });

  it("surfaces confidence so a weakly evidenced verdict is visible as one", () => {
    render(<ComparisonTable comparisons={[comparison({ confidence: "low" })]} />);

    expect(within(table()).getByText("low")).toBeInTheDocument();
  });

  describe("an unassessed skill", () => {
    const notAssessed = comparison({
      skill_label: "Incident Response",
      candidate_level: null,
      ai_level: null,
      confidence: null,
      assessment_state: "not_probed",
      result: "not_assessed",
      delta: null,
    });

    it("is labelled not assessed rather than a gap", () => {
      render(<ComparisonTable comparisons={[notAssessed]} />);

      expect(within(table()).getByText("Not assessed")).toBeInTheDocument();
      expect(within(table()).queryByText("Gap")).not.toBeInTheDocument();
    });

    // Absence of evidence must not be styled as a finding against the candidate.
    it("is styled neutrally, not with the amber a gap uses", () => {
      render(<ComparisonTable comparisons={[notAssessed]} />);

      const badge = within(table()).getByText("Not assessed");
      expect(badge.className).toContain("neutral");
      expect(badge.className).not.toContain("amber");
    });

    it("shows no confidence, because there is no rating to be confident about", () => {
      render(<ComparisonTable comparisons={[notAssessed]} />);

      expect(within(table()).queryByText("high")).not.toBeInTheDocument();
    });

    it("can explain why it was not assessed", async () => {
      render(<ComparisonTable comparisons={[notAssessed]} />);

      const toggle = within(table()).getByRole("button", { name: /why was Incident Response not assessed/i });
      await userEvent.click(toggle);

      expect(await within(table()).findByText(/never raised during the interview/i)).toBeInTheDocument();
    });
  });

  it("shows a skill the candidate has that the vacancy did not ask for", () => {
    render(
      <ComparisonTable
        comparisons={[comparison({ skill_label: "Observability", required_level: null, result: "additional", delta: null, in_vacancy: false })]}
      />,
    );

    expect(within(table()).getByText("Additional")).toBeInTheDocument();
    expect(within(table()).getByText("not required")).toBeInTheDocument();
  });

  it("renders an explanatory empty state rather than a bare table head", () => {
    render(<ComparisonTable comparisons={[]} />);

    expect(screen.getByText("No skills to compare")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
