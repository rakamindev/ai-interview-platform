import { render, screen } from "@testing-library/react";
import FitGapSummary from "@/components/fitgap/FitGapSummary";
import { contractReport } from "@/test/fixtures/fitgap";

describe("FitGapSummary", () => {
  it("counts every outcome including not assessed", () => {
    render(<FitGapSummary summary={contractReport.summary} />);

    expect(screen.getByTestId("summary-match")).toHaveTextContent("1");
    expect(screen.getByTestId("summary-exceed")).toHaveTextContent("1");
    expect(screen.getByTestId("summary-gap")).toHaveTextContent("1");
    expect(screen.getByTestId("summary-not_assessed")).toHaveTextContent("1");
    expect(screen.getByText("4 required skills")).toBeInTheDocument();
  });

  it("warns about limited evidence and unassessed skills", () => {
    render(<FitGapSummary summary={contractReport.summary} />);

    expect(screen.getByText(/1 rating rests on limited evidence/)).toBeInTheDocument();
    expect(screen.getByText(/1 skill was not assessed/)).toBeInTheDocument();
    expect(screen.getByText(/missing evidence is not a gap/)).toBeInTheDocument();
  });

  it("stays quiet when everything was assessed with good evidence", () => {
    render(
      <FitGapSummary summary={{ total: 2, match: 2, gap: 0, exceed: 0, not_assessed: 0, needs_verification: 0 }} />
    );

    expect(screen.queryByText(/limited evidence/)).not.toBeInTheDocument();
    expect(screen.queryByText(/not assessed/i, { selector: "strong" })).not.toBeInTheDocument();
  });
});
