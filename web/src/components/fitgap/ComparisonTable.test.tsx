import { render, screen, within } from "@testing-library/react";
import ComparisonTable from "./ComparisonTable";
import type { SkillComparison } from "@/types";

function comparison(overrides: Partial<SkillComparison> = {}): SkillComparison {
  return {
    skill_label: "Communication",
    expected_level: 3,
    candidate_level: 3,
    result: "match",
    delta: 0,
    ...overrides,
  };
}

function rowFor(label: string) {
  return screen.getByText(label).closest("tr") as HTMLElement;
}

describe("<ComparisonTable />", () => {
  // This column was blank for the life of the feature: the API sends
  // `expected_level` and the component read `required_level`, so it rendered
  // LEVEL_LABELS[undefined]. TypeScript did not object because the type had
  // been written to match the component rather than the payload — which is
  // exactly why it needs a test rather than a type.
  it("shows what the role requires", () => {
    render(<ComparisonTable comparisons={[comparison({ expected_level: 2, candidate_level: 3, result: "exceed", delta: 1 })]} />);

    expect(within(rowFor("Communication")).getByText("L2")).toBeInTheDocument();
  });

  it("shows the candidate's level beside it", () => {
    render(<ComparisonTable comparisons={[comparison({ expected_level: 3, candidate_level: 2, result: "gap", delta: -1 })]} />);

    const row = within(rowFor("Communication"));
    expect(row.getByText("L3")).toBeInTheDocument();
    expect(row.getByText("L2")).toBeInTheDocument();
  });

  it("renders a dash when the interview never reached the skill", () => {
    render(<ComparisonTable comparisons={[comparison({ candidate_level: null, result: "not_assessed", delta: null })]} />);

    expect(within(rowFor("Communication")).getByText("—")).toBeInTheDocument();
  });

  it("marks a row an assessor corrected", () => {
    render(<ComparisonTable comparisons={[comparison({ is_override: true })]} />);

    expect(within(rowFor("Communication")).getByLabelText(/set by an assessor/i)).toBeInTheDocument();
  });

  it("leaves a machine reading unmarked", () => {
    render(<ComparisonTable comparisons={[comparison({ is_override: false })]} />);

    expect(within(rowFor("Communication")).queryByLabelText(/set by an assessor/i)).not.toBeInTheDocument();
  });

  // Emoji were carrying the meaning: a screen reader announced "white heavy
  // check mark" instead of "match", and the glyphs render inconsistently across
  // the fonts installed on Windows.
  describe("accessibility of the result column", () => {
    it("announces the result in words", () => {
      render(<ComparisonTable comparisons={[comparison({ result: "gap", candidate_level: 2, delta: -1 })]} />);

      expect(within(rowFor("Communication")).getByText("Gap −1", { selector: ".sr-only" })).toBeInTheDocument();
    });

    it("spells out what not assessed means rather than leaving a dash", () => {
      render(<ComparisonTable comparisons={[comparison({ result: "not_assessed", candidate_level: null, delta: null })]} />);

      expect(
        within(rowFor("Communication")).getByText(/not covered in the interview/i)
      ).toBeInTheDocument();
    });

    it("uses no emoji at all", () => {
      const { container } = render(
        <ComparisonTable
          comparisons={[
            comparison({ skill_label: "A", result: "match" }),
            comparison({ skill_label: "B", result: "gap", candidate_level: 2, delta: -1 }),
            comparison({ skill_label: "C", result: "exceed", candidate_level: 4, delta: 1 }),
            comparison({ skill_label: "D", result: "not_assessed", candidate_level: null }),
          ]}
        />
      );

      expect(container.textContent ?? "").not.toMatch(/[✅⚠⭐✏️]/);
    });
  });

  describe("the summary line", () => {
    // A three-skill role used to summarise as "Match: 1, Gap: 1" — the skill
    // that could not be matched simply vanished from the tally a hiring manager
    // reads, which reads as a shorter shortlist rather than a gap in the data.
    it("counts skills it could not assess instead of dropping them", () => {
      render(
        <ComparisonTable
          comparisons={[
            comparison({ skill_label: "React", result: "match" }),
            comparison({ skill_label: "Communication", result: "gap", candidate_level: 2, delta: -1 }),
            comparison({ skill_label: "System Design", result: "not_assessed", candidate_level: null, delta: null }),
          ]}
        />
      );

      expect(screen.getByText(/Match: 1 skill/)).toBeInTheDocument();
      expect(screen.getByText(/Gap: 1 skill/)).toBeInTheDocument();
      expect(screen.getByText(/Not assessed: 1 skill/)).toBeInTheDocument();
    });

    it("pluralises honestly", () => {
      render(
        <ComparisonTable
          comparisons={[
            comparison({ skill_label: "A", result: "not_assessed", candidate_level: null }),
            comparison({ skill_label: "B", result: "not_assessed", candidate_level: null }),
          ]}
        />
      );

      expect(screen.getByText(/Not assessed: 2 skills/)).toBeInTheDocument();
    });

    it("says nothing about a category with no members", () => {
      render(<ComparisonTable comparisons={[comparison({ result: "match" })]} />);

      expect(screen.queryByText(/Not assessed/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Gap:/)).not.toBeInTheDocument();
    });
  });
});
