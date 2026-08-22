import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import FitGapReportPage from "@/pages/fitgap/FitGapReportPage";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("@/services/portfolios");
vi.mock("@/services/sessions");

describe("FitGapReportPage Error State", () => {
  it("handles trigger failure with error message state", async () => {
    // Mock portfolio response
    vi.spyOn(sessionsApi, "getPortfolio").mockResolvedValueOnce({
      data: { portfolio: { id: 1, skills: [] } },
    } as any);

    // Mock initial getFitGap to return 404 (needs trigger)
    vi.spyOn(portfoliosApi, "getFitGap").mockRejectedValueOnce({
      response: { status: 404 },
    });

    // Mock trigger to fail
    vi.spyOn(portfoliosApi, "triggerFitGap").mockRejectedValueOnce(new Error("Failed"));

    render(
      <MemoryRouter initialEntries={["/assessments/1/sessions/2/portfolio/fitgap/3"]}>
        <Routes>
          <Route path="/assessments/:id/sessions/:sessionId/portfolio/fitgap/:vacancyId" element={<FitGapReportPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Failed to trigger fit/gap report generation. Please try again.")).toBeInTheDocument();
      expect(screen.getByText("Retry")).toBeInTheDocument();
    });
  });
});
