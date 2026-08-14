import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import type { SkillComparison } from "@/types";

describe("ComparisonTable", () => {
  const comparisons: SkillComparison[] = [
    {
      skill_label: "Node.js / Backend Development",
      expected_level: 3,
      candidate_level: 4,
      result: "exceed",
      delta: 1,
    },
    {
      skill_label: "Communication",
      expected_level: 3,
      candidate_level: 2,
      result: "gap",
      delta: -1,
    },
    {
      skill_label: "System Design",
      expected_level: 4,
      candidate_level: 2,
      result: "gap",
      delta: -2,
      is_override: true,
    },
    {
      skill_label: "Micro-frontends",
      expected_level: 2,
      candidate_level: undefined,
      result: "not_assessed",
    },
  ];

  it("shows the level the role requires, sourced from expected_level (contract fix)", () => {
    render(<ComparisonTable comparisons={comparisons} />);

    // The requirement is what the old table left blank when it read the wrong key.
    expect(screen.getAllByText("Required / reached").length).toBe(comparisons.length);
    expect(screen.getAllByText("L3").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("L4").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("L2").length).toBeGreaterThanOrEqual(2);
  });

  it("states every verdict in words, so colour is never the only signal", () => {
    render(<ComparisonTable comparisons={comparisons} />);

    expect(screen.getByText("Exceeds requirement")).toBeInTheDocument();
    expect(screen.getAllByText("Below requirement").length).toBe(2);
    expect(screen.getAllByText("Not assessed").length).toBeGreaterThan(0);
  });

  it("reads an unassessed skill as absent data, never as a failing score", () => {
    render(<ComparisonTable comparisons={comparisons} />);

    // The whole point of the redesign: a skill the interview skipped must not be
    // presented as a weakness, and must not borrow the gap treatment.
    expect(
      screen.getByText(/never covered this skill, so there is nothing to judge/i),
    ).toBeInTheDocument();
    expect(screen.getByText("no reading")).toBeInTheDocument();

    const track = screen.getByRole("img", { name: "Not assessed" });
    expect(track).toBeInTheDocument();

    // Nothing in the row may borrow the gap treatment: not the verdict text,
    // not the reading, not a single filled segment on the track.
    const row = track.closest("div.grid") as HTMLElement;
    expect(row.querySelector(".text-result-gap")).toBeNull();
    expect(row.querySelector(".bg-result-gap")).toBeNull();
    expect(row.querySelector(".bg-primary")).toBeNull();
    expect(within(row).getByText("Not assessed").className).toContain("text-result-none");
  });

  it("gives the track an accessible reading of reached vs required", () => {
    render(<ComparisonTable comparisons={comparisons} />);

    expect(
      screen.getByRole("img", { name: "Level 4 of 5, role requires level 3" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Level 2 of 5, role requires level 4" }),
    ).toBeInTheDocument();
  });

  it("marks a two-level shortfall more heavily than a one-level one", () => {
    render(<ComparisonTable comparisons={comparisons} />);

    const minusOne = screen.getByText("-1");
    const minusTwo = screen.getByText("-2");
    expect(minusOne.className).not.toContain("font-medium");
    expect(minusTwo.className).toContain("font-medium");
  });

  it("surfaces that a human corrected the AI", () => {
    render(<ComparisonTable comparisons={comparisons} />);
    expect(screen.getByText("Adjusted by assessor")).toBeInTheDocument();
  });

  it("shows candidate evidence as a quote when one is available", () => {
    render(
      <ComparisonTable
        comparisons={comparisons}
        evidenceByLabel={{
          communication: "Saya biasa menjelaskan trade-off teknis ke tim non-teknis.",
        }}
      />,
    );

    expect(
      screen.getByText(/Saya biasa menjelaskan trade-off teknis/),
    ).toBeInTheDocument();
    expect(screen.getAllByText("No quote captured for this skill.").length).toBe(2);
  });

  it("filters the list by verdict without losing the counts", async () => {
    const user = userEvent.setup();
    render(<ComparisonTable comparisons={comparisons} />);

    const belowFilter = screen.getByRole("button", { name: /Below/ });
    expect(within(belowFilter).getByText("2")).toBeInTheDocument();

    await user.click(belowFilter);

    expect(screen.getByText("Communication")).toBeInTheDocument();
    expect(screen.getByText("System Design")).toBeInTheDocument();
    expect(screen.queryByText("Node.js / Backend Development")).not.toBeInTheDocument();
  });
});
