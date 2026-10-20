import { render, screen, within } from "@testing-library/react";
import ComparisonTable from "./ComparisonTable";
import { buildComparison } from "@/test/factories";

function desktopTable() {
  return within(screen.getByRole("table"));
}

describe("ComparisonTable", () => {
  it("shows the required level sent by the API", () => {
    render(<ComparisonTable comparisons={[buildComparison({ expected_level: 4, candidate_level: 2, result: "gap", delta: -2 })]} />);

    const row = desktopTable().getByText("System Design").closest("tr")!;
    expect(within(row).getByText("L4")).toBeInTheDocument();
    expect(within(row).getByText("L2")).toBeInTheDocument();
    expect(within(row).getByText("Gap −2")).toBeInTheDocument();
  });

  it("shows an unassessed skill as no rating with the reason, not as a gap", () => {
    render(
      <ComparisonTable
        comparisons={[
          buildComparison({
            skill_label: "Testing",
            candidate_level: null,
            result: "not_assessed",
            delta: null,
            not_assessed_reason: "not_covered",
          }),
        ]}
      />
    );

    const row = desktopTable().getByText("Testing").closest("tr")!;
    expect(within(row).getByText("No rating")).toBeInTheDocument();
    expect(within(row).getByText("Not assessed")).toBeInTheDocument();
    expect(within(row).getByText("Interview ended before this skill")).toBeInTheDocument();
    expect(within(row).queryByText(/Gap/)).not.toBeInTheDocument();
  });

  it("marks only adjusted levels as adjusted by assessor", () => {
    render(
      <ComparisonTable
        comparisons={[
          buildComparison({ skill_label: "System Design", is_override: true }),
          buildComparison({ skill_label: "Testing", is_override: false }),
        ]}
      />
    );

    expect(desktopTable().getAllByLabelText("Adjusted by assessor")).toHaveLength(1);
  });

  it("summarises not assessed skills separately", () => {
    render(
      <ComparisonTable
        comparisons={[
          buildComparison(),
          buildComparison({ skill_label: "Testing", candidate_level: null, result: "not_assessed", delta: null }),
        ]}
      />
    );

    expect(screen.getByText("Match: 1 skill")).toBeInTheDocument();
    expect(screen.getByText("Not assessed: 1 skill")).toBeInTheDocument();
  });
});
