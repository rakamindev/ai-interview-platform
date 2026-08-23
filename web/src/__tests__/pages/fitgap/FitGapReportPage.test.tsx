import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import FitGapReportPage from "@/pages/fitgap/FitGapReportPage";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("@/services/portfolios");
vi.mock("@/services/sessions");

describe("FitGapReportPage Narratives", () => {
  it("verifies narrative rendering logic for both culture and overall narratives", async () => {
    // Mock portfolio response
    vi.spyOn(sessionsApi, "getPortfolio").mockResolvedValueOnce({
      data: { portfolio: { id: 1, skills: [] } },
    } as any);

    // Mock getFitGap to return report with narratives
    vi.spyOn(portfoliosApi, "getFitGap").mockResolvedValueOnce({
      data: {
        report: {
          skill_comparisons: [],
          culture_narrative: "Culture fit analysis text",
          overall_narrative: "Overall hiring recommendation text",
        },
      },
    } as any);

    render(
      <MemoryRouter initialEntries={["/assessments/1/sessions/2/portfolio/fitgap/3"]}>
        <Routes>
          <Route path="/assessments/:id/sessions/:sessionId/portfolio/fitgap/:vacancyId" element={<FitGapReportPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Culture fit analysis text")).toBeInTheDocument();
      expect(screen.getByText("Overall hiring recommendation text")).toBeInTheDocument();
    });
  });
});

