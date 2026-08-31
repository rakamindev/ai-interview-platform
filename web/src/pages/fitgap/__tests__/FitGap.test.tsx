import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import MockWebSocket from "@/testing/helpers/mockWebSocket";
import MOCK_ACTIVE_SESSION from "@/pages/monitor/__mocks__/activeSession.mock";
import FitGapReportPage from "../FitGapReportPage";

import userEvent from "@testing-library/user-event";
import MOCK_FITGAP from "../__mocks__/fitGap.mock";
import { FIT_GAP_RESULT_LABELS } from "@/utils/constants";
import MOCK_PORTFOLIO from "@/pages/portfolio/__mocks__/portfolio.mock";

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    get: vi.fn(),
    getPortfolio: vi.fn(),
  },
}));
vi.mock("@/services/vacancies", () => ({
  vacanciesApi: {
    list: vi.fn(),
  },
}));
vi.mock("@/services/portfolios", () => ({
  portfoliosApi: {
    getFitGap: vi.fn(),
    triggerFitGap: vi.fn(),
    regenerateFitGap: vi.fn(),
    exportPortfolio: vi.fn(),
  },
}));

describe("Fit/Gap Report Page", () => {
  beforeAll(() => {
    vi.stubGlobal("WebSocket", MockWebSocket);
    vi.mocked(sessionsApi.get).mockResolvedValue({
      data: { session: MOCK_ACTIVE_SESSION },
    } as never);
    vi.mocked(portfoliosApi.getFitGap).mockResolvedValue({
      data: MOCK_FITGAP,
    } as never);
  });

  const renderComponent = () => {
    return render(
      <MemoryRouter initialEntries={["/assessments/4/sessions/16/fitgap/2"]}>
        <Routes>
          <Route
            path="/assessments/:id/sessions/:sessionId/portfolio"
            element={<>Dummy Portfolio</>}
          />
          <Route
            path="/assessments/:id/sessions/:sessionId/fitgap/:vacancyId"
            element={<FitGapReportPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
  };

  it("renderec correctly", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValue({
      data: MOCK_PORTFOLIO,
    } as never);
    renderComponent();

    const [firstSkill] = MOCK_FITGAP.report.skill_comparisons;
    expect(await screen.findByText(firstSkill.skill_label)).toBeInTheDocument();
    expect(
      await screen.findByText(
        new RegExp(FIT_GAP_RESULT_LABELS[firstSkill.result], "i"),
      ),
    ).toBeInTheDocument();
  });
});
