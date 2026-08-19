import { describe, it, expect } from "vite-plus/test";
import { screen, within } from "@testing-library/react";
import { renderWithProviders } from "@/test/utils";
import ComparisonTable from "./ComparisonTable";
import type { SkillComparison } from "@/types";

const comparisons: SkillComparison[] = [
  { skill_label: "React", required_level: 3, candidate_level: 3, result: "match", delta: 0 },
  { skill_label: "Ruby", required_level: 3, candidate_level: 4, result: "exceed", delta: 1 },
  { skill_label: "Docker", required_level: 2, candidate_level: 1, result: "gap", delta: -1 },
  { skill_label: "GraphQL", required_level: 2, candidate_level: undefined, result: "not_assessed" },
];

describe("ComparisonTable", () => {
  it("renders a row per comparison with levels and result badges", () => {
    renderWithProviders(<ComparisonTable comparisons={comparisons} />);
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(5);

    const reactRow = screen.getByRole("row", { name: /React/ });
    expect(within(reactRow).getAllByText("L3")).toHaveLength(2);
    expect(within(reactRow).getByText("Match")).toBeInTheDocument();
  });

  it("annotates gaps and exceeds with their deltas", () => {
    renderWithProviders(<ComparisonTable comparisons={comparisons} />);
    const rubyRow = screen.getByRole("row", { name: /Ruby/ });
    expect(within(rubyRow).getByText(/\+1/)).toBeInTheDocument();
    const dockerRow = screen.getByRole("row", { name: /Docker/ });
    expect(within(dockerRow).getByText(/-1/)).toBeInTheDocument();
  });

  it("shows a dash for unassessed candidate levels", () => {
    renderWithProviders(<ComparisonTable comparisons={comparisons} />);
    const graphqlRow = screen.getByRole("row", { name: /GraphQL/ });
    expect(within(graphqlRow).getByText("—")).toBeInTheDocument();
    expect(within(graphqlRow).getByText("Not assessed")).toBeInTheDocument();
  });

  it("flags overridden levels with the override mark", () => {
    const overridden = [{ ...comparisons[0], is_override: true }, ...comparisons.slice(1)];
    renderWithProviders(<ComparisonTable comparisons={overridden} />);
    expect(screen.getByText("✏ = human override applied")).toBeInTheDocument();
  });

  it("links to the portfolio evidence when ids are provided", () => {
    renderWithProviders(
      <ComparisonTable comparisons={comparisons} assessmentId="5" sessionId="9" />,
    );
    const links = screen.getAllByRole("link", { name: /Evidence/ });
    expect(links[0]).toHaveAttribute("href", "/assessments/5/sessions/9/portfolio?skill=React");
  });

  it("omits evidence links when ids are missing", () => {
    renderWithProviders(<ComparisonTable comparisons={comparisons} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("summarizes the match, gap and exceed counts", () => {
    renderWithProviders(<ComparisonTable comparisons={comparisons} />);
    expect(screen.getByText("✅ Match: 1 skill")).toBeInTheDocument();
    expect(screen.getByText("⚠ Gap: 1 skill")).toBeInTheDocument();
    expect(screen.getByText("⭐ Exceeds: 1 skill")).toBeInTheDocument();
  });

  it("uses singular wording for a single match", () => {
    const onlyMatch = [comparisons[0]];
    renderWithProviders(<ComparisonTable comparisons={onlyMatch} />);
    expect(screen.getByText("✅ Match: 1 skill")).toBeInTheDocument();
  });

  it("uses plural wording and omits deltas when they are absent", () => {
    const plural: SkillComparison[] = [
      { skill_label: "A", required_level: 3, candidate_level: 3, result: "match", delta: 0 },
      { skill_label: "B", required_level: 3, candidate_level: 3, result: "match", delta: 0 },
      { skill_label: "C", required_level: 3, candidate_level: 4, result: "exceed" },
      { skill_label: "D", required_level: 3, candidate_level: 4, result: "exceed" },
      { skill_label: "E", required_level: 3, candidate_level: 2, result: "gap" },
      { skill_label: "F", required_level: 3, candidate_level: 2, result: "gap" },
    ];
    renderWithProviders(<ComparisonTable comparisons={plural} />);
    expect(screen.getByText("✅ Match: 2 skills")).toBeInTheDocument();
    expect(screen.getByText("⚠ Gap: 2 skills")).toBeInTheDocument();
    expect(screen.getByText("⭐ Exceeds: 2 skills")).toBeInTheDocument();
  });
});
