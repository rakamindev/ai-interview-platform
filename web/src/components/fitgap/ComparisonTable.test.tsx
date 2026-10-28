import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import type { SkillComparison } from "@/types";

// Characterization test: proves the harness renders a real component.
// Behaviour that is known to be broken (Required column, override marker,
// summary counts) is intentionally not asserted here.
const comparisons: SkillComparison[] = [
    { skill_label: "Contoh Ruby on Rails", expected_level: 3, candidate_level: 3, level_source: "ai", is_override: false,
      confidence: "high", result: "match", delta: 0, counts_toward_fit: true },
    { skill_label: "Contoh System Design", expected_level: 4, candidate_level: null, level_source: null, is_override: false,
      confidence: null, result: "not_assessed", delta: null, counts_toward_fit: false },
];

describe("ComparisonTable", () => {
    it("renders a row for every skill comparison", () => {
        render(<ComparisonTable comparisons={comparisons} />);

        expect(screen.getByText("Contoh Ruby on Rails")).toBeInTheDocument();
        expect(screen.getByText("Contoh System Design")).toBeInTheDocument();
    });
});
