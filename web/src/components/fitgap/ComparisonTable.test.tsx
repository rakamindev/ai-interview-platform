import { render, screen, within } from "@testing-library/react";
import ComparisonTable from "./ComparisonTable";
import { LEVEL_LABELS } from "@/utils/constants";
import type { SkillComparison } from "@/types";

const comparisons: SkillComparison[] = [
  { skill_label: "Ruby on Rails", required_level: 3, candidate_level: 3, result: "match", delta: 0, is_override: false },
  { skill_label: "GraphQL", required_level: 4, candidate_level: 2, result: "gap", delta: -2, is_override: false },
  { skill_label: "Docker", required_level: 2, candidate_level: 5, result: "exceed", delta: 1, is_override: true },
  { skill_label: "Kafka", required_level: 3, candidate_level: 1, result: "gap", delta: -2, is_override: false },
  { skill_label: "Kubernetes", required_level: 3, result: "not_assessed", is_override: false },
];

function rowFor(label: string): HTMLElement {
  return screen.getAllByRole("row").slice(1).find((row) => within(row).queryByText(label) !== null)!;
}

describe("ComparisonTable", () => {
  it("renders one row per comparison with skill label and required level label", () => {
    render(<ComparisonTable comparisons={comparisons} />);
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(comparisons.length);
    comparisons.forEach((c) => {
      const row = rowFor(c.skill_label);
      expect(within(row).getByText(c.skill_label)).toBeInTheDocument();
      expect(within(row).getAllByText(LEVEL_LABELS[c.required_level]).length).toBeGreaterThan(0);
    });
  });

  it("renders the candidate level label when present", () => {
    render(<ComparisonTable comparisons={comparisons} />);
    expect(within(rowFor("GraphQL")).getByText("L2")).toBeInTheDocument();
    expect(within(rowFor("Docker")).getByText("L5")).toBeInTheDocument();
  });

  it('renders an em dash "—" when candidate_level is null', () => {
    render(<ComparisonTable comparisons={comparisons} />);
    expect(within(rowFor("Kubernetes")).getByText("—")).toBeInTheDocument();
  });

  it("shows Gap with a negative delta suffix for a gap row", () => {
    render(<ComparisonTable comparisons={comparisons} />);
    expect(within(rowFor("GraphQL")).getByText(/Gap -2/)).toBeInTheDocument();
  });

  it("shows Exceeds with a positive delta suffix for an exceed row", () => {
    render(<ComparisonTable comparisons={comparisons} />);
    expect(within(rowFor("Docker")).getByText(/Exceeds \+1/)).toBeInTheDocument();
  });

  it("shows the override pencil icon when is_override is true and not when false", () => {
    render(<ComparisonTable comparisons={comparisons} />);
    expect(rowFor("Docker").querySelector(".lucide-pencil")).not.toBeNull();
    expect(rowFor("Ruby on Rails").querySelector(".lucide-pencil")).toBeNull();
    expect(rowFor("GraphQL").querySelector(".lucide-pencil")).toBeNull();
  });

  it("renders the summary with correct counts and skill pluralization", () => {
    render(<ComparisonTable comparisons={comparisons} />);
    expect(screen.getByText(/Match: 1 skill/)).toBeInTheDocument();
    expect(screen.getByText(/Gap: 2 skills/)).toBeInTheDocument();
    expect(screen.getByText(/Exceeds: 1 skill/)).toBeInTheDocument();
    expect(screen.getByText(/Not assessed: 1 skill/)).toBeInTheDocument();
  });

  it("omits ‘Not assessed’ from the summary when its count is zero", () => {
    const noNotAssessed = comparisons.filter((c) => c.result !== "not_assessed");
    render(<ComparisonTable comparisons={noNotAssessed} />);
    expect(screen.queryByText(/Not assessed: 1 skill/)).toBeNull();
    expect(screen.getByText(/Match: 1 skill/)).toBeInTheDocument();
  });

  it('renders the "human override applied" legend exactly once', () => {
    render(<ComparisonTable comparisons={comparisons} />);
    expect(screen.getAllByText(/human override applied/)).toHaveLength(1);
  });

  it("shows an empty state when there are no comparisons", () => {
    render(<ComparisonTable comparisons={[]} />);
    expect(screen.getByText("No skill comparisons are available for this vacancy.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});