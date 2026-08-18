import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import ComparisonTable from "./ComparisonTable";
import type { SkillComparison } from "@/types";

/**
 * These assert on what an assessor can actually read on the page.
 *
 * The bug that motivated the suite was invisible to `tsc`: the API emits
 * `expected_level` and the client declared `required_level`, so every row
 * rendered an empty Required cell while the build stayed green. Type
 * annotations describe the contract; only a render assertion checks it.
 */

const base: SkillComparison = {
  skill_label: "React",
  skill_id: "SK-ENG-001",
  expected_level: 4,
  candidate_level: 4,
  result: "match",
  delta: 0,
  confidence: "high",
  is_override: false,
  ai_level: 4,
  not_assessed_reason: null,
};

const make = (o: Partial<SkillComparison> = {}): SkillComparison => ({ ...base, ...o });

/** The desktop table is one of two renderings; scope queries to it. */
const table = () => screen.getByRole("table");
const rowFor = (label: string) =>
  within(table())
    .getAllByRole("row")
    .find((r) => within(r).queryByText(label)) as HTMLElement;

/**
 * Cells by column, because "L4" legitimately appears in both the Required and
 * Candidate cells of a matching row — a bare getByText would be ambiguous and
 * would pass even if the Required cell were empty.
 */
const cells = (label: string) => within(rowFor(label)).getAllByRole("cell");
const requiredCell = (label: string) => cells(label)[1];
const candidateCell = (label: string) => cells(label)[2];

/** The coverage bar's aria-label is the machine-readable summary. */
const summary = () => screen.getByRole("img").getAttribute("aria-label") ?? "";

describe("ComparisonTable", () => {
  describe("the Required column", () => {
    // The regression under test: this cell was empty on every row because the
    // client read `required_level` and the API emits `expected_level`.
    it("renders the level the role requires", () => {
      render(<ComparisonTable comparisons={[make({ expected_level: 4, candidate_level: 2, result: "gap", delta: -2 })]} />);
      expect(requiredCell("React")).toHaveTextContent("L4");
    });

    it("is never empty", () => {
      render(<ComparisonTable comparisons={[make({ expected_level: 4 })]} />);
      expect(requiredCell("React").textContent?.trim()).not.toBe("");
    });

    it("renders it for every row, including unassessed ones", () => {
      render(
        <ComparisonTable
          comparisons={[
            make({ skill_label: "Security", expected_level: 3, candidate_level: null, result: "not_assessed" }),
          ]}
        />
      );
      expect(requiredCell("Security")).toHaveTextContent("L3");
    });
  });

  describe("skills that were not assessed", () => {
    const comparisons = [
      make({ skill_label: "React", result: "match" }),
      make({ skill_label: "TypeScript", expected_level: 3, candidate_level: 4, result: "exceed", delta: 1 }),
      make({ skill_label: "Design", expected_level: 4, candidate_level: 2, result: "gap", delta: -2 }),
      make({
        skill_label: "Security",
        candidate_level: null,
        result: "not_assessed",
        delta: null,
        not_assessed_reason: "not_covered",
      }),
      make({
        skill_label: "REST",
        candidate_level: null,
        result: "not_assessed",
        delta: null,
        not_assessed_reason: "insufficient_evidence",
      }),
    ];

    // The defect: the summary counted match, gap and exceed only, so a
    // five-skill role reported on three and the reader had no way to notice.
    it("counts them in the summary", () => {
      render(<ComparisonTable comparisons={comparisons} />);
      expect(screen.getByText("Not assessed 2")).toBeInTheDocument();
    });

    it("summary counts add up to the number of required skills", () => {
      render(<ComparisonTable comparisons={comparisons} />);

      const counts = summary().match(/(\d+) match.*?(\d+) exceeds.*?(\d+) gap.*?(\d+) not assessed/i);
      expect(counts).not.toBeNull();

      const total = counts!.slice(1, 5).reduce((sum, n) => sum + Number(n), 0);
      expect(total).toBe(comparisons.length);
      expect(screen.getByText("5 required skills")).toBeInTheDocument();
    });

    it("states the incompleteness before the table", () => {
      render(<ComparisonTable comparisons={comparisons} />);
      expect(screen.getByRole("status")).toHaveTextContent(
        /2 of 5 required skills were not assessed/i
      );
    });

    it("says absence of evidence is not evidence of a gap", () => {
      render(<ComparisonTable comparisons={comparisons} />);
      expect(screen.getByRole("status")).toHaveTextContent(/absence of evidence is not evidence of a gap/i);
    });

    it("does not show the banner when everything was assessed", () => {
      render(<ComparisonTable comparisons={[make()]} />);
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("shows a dash rather than a level", () => {
      render(
        <ComparisonTable
          comparisons={[make({ skill_label: "Security", candidate_level: null, result: "not_assessed" })]}
        />
      );
      expect(within(rowFor("Security")).getByText("—")).toBeInTheDocument();
    });

    it("distinguishes never-covered from insufficient-evidence", () => {
      render(<ComparisonTable comparisons={comparisons} />);
      expect(within(rowFor("Security")).getByTitle(/never reached this skill/i)).toBeInTheDocument();
      expect(
        within(rowFor("REST")).getByTitle(/evidence did not support a level/i)
      ).toBeInTheDocument();
    });
  });

  describe("assessor overrides", () => {
    it("marks a row whose level a human changed", () => {
      render(
        <ComparisonTable
          comparisons={[make({ skill_label: "Testing", candidate_level: 2, ai_level: 3, is_override: true, result: "gap", delta: -2 })]}
        />
      );
      expect(within(rowFor("Testing")).getByText("was L3")).toBeInTheDocument();
    });

    it("explains the provenance in the title", () => {
      render(
        <ComparisonTable
          comparisons={[make({ skill_label: "Testing", candidate_level: 2, ai_level: 3, is_override: true })]}
        />
      );
      expect(
        within(rowFor("Testing")).getByTitle(/model assessed L3.*assessor recorded L2/i)
      ).toBeInTheDocument();
    });

    // The legend previously claimed a marker that could never render, because
    // the API never sent the flag.
    it("shows no marker when the level is the model's", () => {
      render(<ComparisonTable comparisons={[make({ skill_label: "React", is_override: false })]} />);
      expect(within(rowFor("React")).queryByText(/^was L/)).not.toBeInTheDocument();
    });
  });

  describe("edge cases", () => {
    it("renders an empty state instead of a headers-only table", () => {
      render(<ComparisonTable comparisons={[]} />);
      expect(screen.getByText(/no skills to compare/i)).toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("keeps a 255-character label readable without losing it", () => {
      // No trailing whitespace: Testing Library normalises it out of the
      // attribute before comparing, which would make this fail spuriously.
      const long = "Cloud Infrastructure ".repeat(12).slice(0, 255).trim();
      render(<ComparisonTable comparisons={[make({ skill_label: long })]} />);

      // Truncated visually, but the full text stays available on hover and to
      // assistive tech rather than being cut off in the DOM.
      expect(within(table()).getByTitle(long)).toBeInTheDocument();
      expect(within(table()).getByTitle(long)).toHaveClass("truncate");
    });

    it("renders both rows when two required skills share a label", () => {
      render(
        <ComparisonTable
          comparisons={[
            make({ skill_label: "Comms", skill_id: null, expected_level: 2 }),
            make({ skill_label: "Comms", skill_id: null, expected_level: 4 }),
          ]}
        />
      );
      expect(within(table()).getAllByText("Comms")).toHaveLength(2);
    });

    it("does not render a +0 suffix on a match", () => {
      render(<ComparisonTable comparisons={[make({ result: "match", delta: 0 })]} />);
      expect(within(rowFor("React")).getByText("Match")).toBeInTheDocument();
      expect(within(rowFor("React")).queryByText(/Match ?\+?0/)).not.toBeInTheDocument();
    });

    it("renders a signed delta on a gap", () => {
      render(
        <ComparisonTable comparisons={[make({ skill_label: "Design", result: "gap", delta: -2, candidate_level: 2 })]} />
      );
      expect(within(rowFor("Design")).getByText(/Gap\s*-2/)).toBeInTheDocument();
    });
  });
});
