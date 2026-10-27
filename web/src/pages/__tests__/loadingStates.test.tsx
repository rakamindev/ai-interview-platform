import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import type { ComponentType } from "react";
import AssessmentListPage from "../assessments/AssessmentListPage";
import AssessmentEditPage from "../assessments/AssessmentEditPage";
import AssessmentInvitePage from "../assessments/AssessmentInvitePage";
import VacancyListPage from "../vacancies/VacancyListPage";
import VacancyEditPage from "../vacancies/VacancyEditPage";
import PortfolioPage from "../portfolio/PortfolioPage";
import FitGapReportPage from "../fitgap/FitGapReportPage";
import TranscriptPage from "../transcript/TranscriptPage";
import LiveMonitorPage from "../monitor/LiveMonitorPage";
import InterviewPage from "../interview/InterviewPage";

// Every API call stays pending, so each page is frozen in its loading state.
const { pendingApi } = vi.hoisted(() => ({
  pendingApi: () => new Proxy({}, { get: () => () => new Promise(() => {}) }),
}));
vi.mock("@/services/assessments", () => ({ assessmentsApi: pendingApi() }));
vi.mock("@/services/vacancies", () => ({ vacanciesApi: pendingApi() }));
vi.mock("@/services/sessions", () => ({ sessionsApi: pendingApi() }));
vi.mock("@/services/portfolios", () => ({ portfoliosApi: pendingApi() }));
vi.mock("@/hooks/useCoverageWebSocket", () => ({ useCoverageWebSocket: () => ({ isConnected: false }) }));

const pages: [string, ComponentType, string, string][] = [
  ["assessment list", AssessmentListPage, "/assessments", "/assessments"],
  ["assessment edit", AssessmentEditPage, "/assessments/:id/edit", "/assessments/1/edit"],
  ["assessment sessions", AssessmentInvitePage, "/assessments/:id/invite", "/assessments/1/invite"],
  ["vacancy list", VacancyListPage, "/vacancies", "/vacancies"],
  ["vacancy edit", VacancyEditPage, "/vacancies/:id/edit", "/vacancies/2/edit"],
  ["portfolio", PortfolioPage, "/assessments/:id/sessions/:sessionId/portfolio", "/assessments/1/sessions/1/portfolio"],
  ["fit/gap report", FitGapReportPage, "/assessments/:id/sessions/:sessionId/fitgap/:vacancyId", "/assessments/1/sessions/1/fitgap/1"],
  ["transcript", TranscriptPage, "/assessments/:id/sessions/:sessionId/transcript", "/assessments/1/sessions/1/transcript"],
  ["live monitor", LiveMonitorPage, "/assessments/:id/sessions/:sessionId/monitor", "/assessments/1/sessions/1/monitor"],
  ["candidate interview", InterviewPage, "/interview/:token", "/interview/abc"],
];

describe("loading states", () => {
  it.each(pages)("%s shows a skeleton while its data loads", (_name, Page, path, url) => {
    render(
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path={path} element={<Page />} />
        </Routes>
      </MemoryRouter>,
    );

    const status = screen.getAllByRole("status").find((el) => el.getAttribute("aria-busy") === "true");
    expect(status).toBeDefined();
  });
});
