import { render, screen } from "@testing-library/react";
import ComparisonTable from "./ComparisonTable";
import type { SkillComparison } from "@/types";

const base: SkillComparison[] = [
  { skill_label: "Ruby", expected_level: 3, candidate_level: 3, result: "match", delta: 0 },
  { skill_label: "Go", expected_level: 4, candidate_level: 2, result: "gap", delta: -2 },
  {
    skill_label: "Python",
    expected_level: 2,
    candidate_level: null,
    result: "not_assessed",
    delta: null,
  },
];

test("renders Required as L3/L4 not blank (P0-1)", () => {
  render(<ComparisonTable comparisons={base} />);
  expect(screen.getAllByText("L3").length).toBeGreaterThan(0);
  expect(screen.getAllByText("L4").length).toBeGreaterThan(0);
});

test("renders Not assessed summary count (P1-1)", () => {
  render(<ComparisonTable comparisons={base} />);
  expect(screen.getByText(/Not assessed:\s*1/)).toBeInTheDocument();
});

test("renders override marker when overridden true (P0-2)", () => {
  const withOverride: SkillComparison[] = [
    {
      skill_label: "Ruby",
      expected_level: 3,
      candidate_level: 4,
      result: "exceed",
      delta: 1,
      overridden: true,
    },
  ];
  render(<ComparisonTable comparisons={withOverride} />);
  expect(screen.getByText("✏")).toBeInTheDocument();
});

test("renders explicit Not assessed for null candidate_level (P1-1 row)", () => {
  render(<ComparisonTable comparisons={base} />);
  expect(screen.getByText("Not assessed")).toBeInTheDocument();
});

test("normalizes is_override alias to marker (P0-2 alias)", () => {
  const withAlias: SkillComparison[] = [
    {
      skill_label: "Ruby",
      expected_level: 3,
      candidate_level: 4,
      result: "exceed",
      delta: 1,
      is_override: true,
    },
  ];
  render(<ComparisonTable comparisons={withAlias} />);
  expect(screen.getByText("✏")).toBeInTheDocument();
});
