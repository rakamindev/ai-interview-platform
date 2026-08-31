import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import userEvent from "@testing-library/user-event";

import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import MOCK_ACTIVE_SESSION from "@/pages/monitor/__mocks__/activeSession.mock";
import PortfolioPage from "../PortfolioPage";
import MOCK_PORTFOLIO, {
  MOCK_FAIL_PORTFOLIO,
} from "../__mocks__/portfolio.mock";
import MOCK_VACANCIES from "../__mocks__/vacancies.mock";

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

describe("Portfolio Page", () => {
  beforeAll(() => {
    vi.mocked(sessionsApi.get).mockResolvedValue({
      data: { session: MOCK_ACTIVE_SESSION },
    } as never);
    vi.mocked(vacanciesApi.list).mockResolvedValue({
      data: MOCK_VACANCIES,
    } as never);
  });

  const renderComponent = () => {
    return render(
      <MemoryRouter initialEntries={["/assessments/1/sessions/14/portfolio"]}>
        <Routes>
          <Route
            path="/assessments/:id/sessions/:sessionId/portfolio"
            element={<PortfolioPage />}
          />
          <Route path="/assessments/:id/invite" element={<>Dummy Invite</>} />
          <Route
            path="/assessments/:id/sessions/:sessionId/fitgap/:vacancyId"
            element={<>Dummy Fit/Gap</>}
          />
        </Routes>
      </MemoryRouter>,
    );
  };

  it("error message", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValue({
      data: MOCK_FAIL_PORTFOLIO,
    } as never);
    renderComponent();

    expect(
      await screen.findByText(/portfolio generation failed/i),
    ).toBeInTheDocument();
  });

  it("success results", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValue({
      data: MOCK_PORTFOLIO,
    } as never);
    renderComponent();

    const [firstSkill] = MOCK_PORTFOLIO.portfolio.skills;
    expect(await screen.findByText(firstSkill.skill_label)).toBeInTheDocument();

    const btnRunAnalysis = screen.getByRole("button", {
      name: /Run Fit\/Gap Analysis/i,
    });
    expect(btnRunAnalysis).toBeDisabled();

    const vacancyDropdown = screen.getByRole("combobox");
    await userEvent.click(vacancyDropdown);
    const [_, vacancy] = MOCK_VACANCIES.vacancies;
    const vacancyOption = await screen.findByRole("option", {
      name: vacancy.role_title,
    });
    await userEvent.click(vacancyOption);
    expect(vacancyDropdown).toHaveTextContent(vacancy.role_title);
    expect(btnRunAnalysis).toBeEnabled();

    fireEvent.click(btnRunAnalysis);
    expect(await screen.findByText("Dummy Fit/Gap")).toBeInTheDocument();
  });
});
