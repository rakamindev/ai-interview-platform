import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ComparisonTable from "./ComparisonTable";

describe("ComparisonTable", () => {
  it("shows the level the vacancy asks for, even when the skill was not assessed", () => {
    render(
      <ComparisonTable
        comparisons={[{ skill_label: "Leadership", expected_level: 3, candidate_level: null, result: "not_assessed", delta: null }]}
      />
    );

    expect(screen.getByText("L3")).toBeInTheDocument();
  });
});
