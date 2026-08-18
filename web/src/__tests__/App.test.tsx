import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { createStore, Provider } from "jotai";
import { describe, expect, it, vi } from "vitest";
import App from "@/App";
import { authAtom } from "@/stores/authAtom";

vi.mock("@/services/auth", () => ({ authApi: { login: vi.fn() } }));

vi.mock("@/pages/auth/LoginPage", () => ({
  default: () => <div>LoginPage stub</div>,
}));
vi.mock("@/pages/assessments/AssessmentListPage", () => ({
  default: () => <div>AssessmentListPage stub</div>,
}));
vi.mock("@/pages/assessments/AssessmentNewPage", () => ({
  default: () => <div>AssessmentNewPage stub</div>,
}));
vi.mock("@/pages/assessments/AssessmentEditPage", () => ({
  default: () => <div>AssessmentEditPage stub</div>,
}));
vi.mock("@/pages/assessments/AssessmentInvitePage", () => ({
  default: () => <div>AssessmentInvitePage stub</div>,
}));
vi.mock("@/pages/monitor/LiveMonitorPage", () => ({
  default: () => <div>LiveMonitorPage stub</div>,
}));
vi.mock("@/pages/portfolio/PortfolioPage", () => ({
  default: () => <div>PortfolioPage stub</div>,
}));
vi.mock("@/pages/fitgap/FitGapReportPage", () => ({
  default: () => <div>FitGapReportPage stub</div>,
}));
vi.mock("@/pages/transcript/TranscriptPage", () => ({
  default: () => <div>TranscriptPage stub</div>,
}));
vi.mock("@/pages/vacancies/VacancyListPage", () => ({
  default: () => <div>VacancyListPage stub</div>,
}));
vi.mock("@/pages/vacancies/VacancyNewPage", () => ({
  default: () => <div>VacancyNewPage stub</div>,
}));
vi.mock("@/pages/vacancies/VacancyEditPage", () => ({
  default: () => <div>VacancyEditPage stub</div>,
}));
vi.mock("@/pages/interview/InterviewPage", () => ({
  default: () => <div>InterviewPage stub</div>,
}));

function renderApp(initialEntries: string[], { authed = false } = {}) {
  const store = createStore();
  // authAtom's initial value falls back to VITE_DEV_TOKEN when set (see .env),
  // so explicitly set both states rather than relying on the atom's default.
  store.set(authAtom, { token: authed ? "test-token" : null });
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={initialEntries}>
        <App />
      </MemoryRouter>
    </Provider>
  );
}

describe("App routing", () => {
  it("renders the login page at /login", () => {
    renderApp(["/login"]);
    expect(screen.getByText("LoginPage stub")).toBeInTheDocument();
  });

  it("renders the 404 page for an unknown route", () => {
    renderApp(["/this-route-does-not-exist"], { authed: true });
    expect(screen.getByText("404")).toBeInTheDocument();
  });

  it("redirects unauthenticated users away from a protected route to /login", () => {
    renderApp(["/assessments"]);
    expect(screen.getByText("LoginPage stub")).toBeInTheDocument();
  });

  it("redirects / to /assessments for an authenticated user", () => {
    renderApp(["/"], { authed: true });
    expect(screen.getByText("AssessmentListPage stub")).toBeInTheDocument();
  });
});
