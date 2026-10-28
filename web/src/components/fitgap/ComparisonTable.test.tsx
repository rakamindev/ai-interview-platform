import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import ComparisonTable from "./ComparisonTable";
import type { SkillComparison } from "@/types";

function row(overrides: Partial<SkillComparison> = {}): SkillComparison {
  return {
    skill_label: "React",
    expected_level: 3,
    candidate_level: 3,
    result: "match",
    delta: 0,
    ...overrides,
  };
}

// The page renders a table for wide screens and a list for narrow ones, so scope to the table.
const table = () => within(screen.getByRole("table"));

describe("ComparisonTable", () => {
  it("shows the required level that the API sends as expected_level", () => {
    render(<ComparisonTable comparisons={[row({ skill_label: "SQL", expected_level: 4, candidate_level: 2, result: "gap", delta: -2 })]} />);

    const cells = table().getAllByRole("row")[1].querySelectorAll("td");
    expect(cells[1]).toHaveTextContent("L4");
    expect(cells[2]).toHaveTextContent("L2");
    expect(cells[3]).toHaveTextContent("Gap -2");
  });

  it("marks a level that an assessor set by hand", () => {
    render(<ComparisonTable comparisons={[row({ is_override: true })]} />);

    expect(table().getByLabelText("Level set by an assessor")).toBeInTheDocument();
  });

  it("flags a level the model is unsure about", () => {
    render(<ComparisonTable comparisons={[row({ low_confidence: true })]} />);

    expect(table().getByText("Low confidence")).toBeInTheDocument();
    expect(screen.getByText("Low confidence: 1 skill")).toBeInTheDocument();
  });

  it("warns and counts skills that were not assessed", () => {
    render(
      <ComparisonTable
        comparisons={[
          row({ skill_label: "React" }),
          row({ skill_label: "Kafka", candidate_level: null, result: "not_assessed", delta: null }),
          row({ skill_label: "Redis", candidate_level: null, result: "not_assessed", delta: null }),
        ]}
      />
    );

    expect(screen.getByText(/2 of 3 required skills were not assessed/)).toBeInTheDocument();
    expect(screen.getByText("— Not assessed: 2 skills")).toBeInTheDocument();
  });

  it("does not show the warning when every skill was assessed", () => {
    render(<ComparisonTable comparisons={[row()]} />);

    expect(screen.queryByText(/not assessed in this interview/)).not.toBeInTheDocument();
  });

  it("says so when the vacancy has no required skills", () => {
    render(<ComparisonTable comparisons={[]} />);

    expect(screen.getByRole("status")).toHaveTextContent("no required skills");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("still renders reports saved before is_override and low_confidence existed", () => {
    render(<ComparisonTable comparisons={[row()]} />);

    expect(table().queryByLabelText("Level set by an assessor")).not.toBeInTheDocument();
    expect(table().queryByText("Low confidence")).not.toBeInTheDocument();
    expect(table().getByText("React")).toBeInTheDocument();
  });

  it("keeps a very long skill name inside its cell", () => {
    const longName = "Distributed systems design and operation in production ".repeat(4).trim();
    render(<ComparisonTable comparisons={[row({ skill_label: longName })]} />);

    expect(table().getByText(longName)).toHaveClass("break-words");
  });
});
