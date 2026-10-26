import { render, screen, within } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import { contractReport } from "@/test/fixtures/fitgap";

describe("ComparisonTable (API contract)", () => {
  it("shows the required level the API sends for every skill", () => {
    render(
      <TooltipProvider>
        <ComparisonTable comparisons={contractReport.skill_comparisons} />
      </TooltipProvider>
    );

    const row = screen.getByText("Communication").closest<HTMLElement>("[data-testid='comparison-row']")!;
    expect(within(row).getByTestId("required-level")).toHaveTextContent("L3"); // required
    expect(within(row).getByTestId("candidate-level")).toHaveTextContent("L2"); // candidate
  });
});
