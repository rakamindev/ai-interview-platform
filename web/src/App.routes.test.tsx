import { describe, it, expect, vi } from "vite-plus/test";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/utils";

// Render nested routes by mocking the layouts + guard to pass children through Outlet,
// and every page to a trivial marker. This exercises App's lazy() route factories and
// verifies the route table wires each path to the right element.
vi.mock("@/components/ProtectedRoute", async () => {
  const rr = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { default: () => <rr.Outlet /> };
});
vi.mock("@/components/layout/AssessorLayout", async () => {
  const rr = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { default: () => <rr.Outlet /> };
});
vi.mock("@/components/layout/CandidateLayout", async () => {
  const rr = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { default: () => <rr.Outlet /> };
});

vi.mock("@/pages/auth/LoginPage", () => ({ default: () => <div>LOGIN</div> }));
vi.mock("@/pages/auth/SignupPage", () => ({ default: () => <div>SIGNUP</div> }));
vi.mock("@/pages/auth/AccessDeniedPage", () => ({ default: () => <div>ACCESS_DENIED</div> }));
vi.mock("@/pages/assessments/AssessmentListPage", () => ({
  default: () => <div>ASSESSMENT_LIST</div>,
}));
vi.mock("@/pages/assessments/AssessmentNewPage", () => ({
  default: () => <div>ASSESSMENT_NEW</div>,
}));
vi.mock("@/pages/assessments/AssessmentEditPage", () => ({
  default: () => <div>ASSESSMENT_EDIT</div>,
}));
vi.mock("@/pages/assessments/AssessmentInvitePage", () => ({
  default: () => <div>ASSESSMENT_INVITE</div>,
}));
vi.mock("@/pages/monitor/LiveMonitorPage", () => ({ default: () => <div>LIVE_MONITOR</div> }));
vi.mock("@/pages/portfolio/PortfolioPage", () => ({ default: () => <div>PORTFOLIO</div> }));
vi.mock("@/pages/fitgap/FitGapReportPage", () => ({ default: () => <div>FITGAP</div> }));
vi.mock("@/pages/transcript/TranscriptPage", () => ({ default: () => <div>TRANSCRIPT</div> }));
vi.mock("@/pages/vacancies/VacancyListPage", () => ({ default: () => <div>VACANCY_LIST</div> }));
vi.mock("@/pages/vacancies/VacancyNewPage", () => ({ default: () => <div>VACANCY_NEW</div> }));
vi.mock("@/pages/vacancies/VacancyEditPage", () => ({ default: () => <div>VACANCY_EDIT</div> }));
vi.mock("@/pages/interview/InterviewPage", () => ({ default: () => <div>INTERVIEW</div> }));

import App from "./App";

const cases: Array<[string, string]> = [
  ["/", "ASSESSMENT_LIST"],
  ["/login", "LOGIN"],
  ["/signup", "SIGNUP"],
  ["/access-denied", "ACCESS_DENIED"],
  ["/assessments", "ASSESSMENT_LIST"],
  ["/assessments/new", "ASSESSMENT_NEW"],
  ["/assessments/1/edit", "ASSESSMENT_EDIT"],
  ["/assessments/1/invite", "ASSESSMENT_INVITE"],
  ["/assessments/1/sessions/2/monitor", "LIVE_MONITOR"],
  ["/assessments/1/sessions/2/portfolio", "PORTFOLIO"],
  ["/assessments/1/sessions/2/transcript", "TRANSCRIPT"],
  ["/assessments/1/sessions/2/fitgap/3", "FITGAP"],
  ["/vacancies", "VACANCY_LIST"],
  ["/vacancies/new", "VACANCY_NEW"],
  ["/vacancies/1/edit", "VACANCY_EDIT"],
  ["/interview/tok123", "INTERVIEW"],
];

describe("App route table", () => {
  it.each(cases)("routes %s to the expected page", async (path, marker) => {
    renderWithProviders(<App />, { route: path });
    expect(await screen.findByText(marker, undefined, { timeout: 5000 })).toBeInTheDocument();
  });
});
