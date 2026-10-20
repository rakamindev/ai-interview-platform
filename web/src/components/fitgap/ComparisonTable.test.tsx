import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import ComparisonTable from "./ComparisonTable";
import type { SkillComparison } from "@/types";

afterEach(cleanup);

describe("ComparisonTable", () => {
  it("keeps an unassessed skill distinct from a low candidate rating", () => {
    const comparisons: SkillComparison[] = [{
      skill_label: "SQL",
      expected_level: 3,
      candidate_level: null,
      result: "not_assessed",
      delta: null,
      is_override: false,
    }];

    render(<ComparisonTable comparisons={comparisons} />);

    expect(screen.getByRole("group", { name: "Comparison summary" }).textContent).toContain("Not assessed");
    expect(screen.getByRole("row", { name: /SQL/ }).textContent).toContain("Not assessed");
  });

  it("explains the empty comparison state", () => {
    render(<ComparisonTable comparisons={[]} />);

    expect(screen.getByText("No skill comparisons are available for this vacancy.")).toBeTruthy();
  });
});
