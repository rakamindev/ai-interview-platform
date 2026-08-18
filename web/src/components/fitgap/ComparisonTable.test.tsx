import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ComparisonTable from "./ComparisonTable";

describe("ComparisonTable", () => {
  it("shows not_assessed as distinct and maps expected_level to required", () => {
    render(
      <ComparisonTable
        comparisons={[
          {
            skill_label: "System Design",
            result: "not_assessed",
            expected_level: 2,
            candidate_level: null,
          },
          {
            skill_label: "React",
            result: "gap",
            expected_level: 4,
            candidate_level: 2,
            delta: -2,
            overridden: true,
          },
        ]}
      />
    );

    expect(screen.getByText("System Design")).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText(/Not assessed: 1 skill/)).toBeInTheDocument();
    expect(screen.getByText(/Gap: 1 skill/)).toBeInTheDocument();
    expect(screen.getByText("✏")).toBeInTheDocument();
  });
});
