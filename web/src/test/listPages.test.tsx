import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "@/pages/auth/LoginPage";
import NotFoundPage from "@/pages/NotFoundPage";
import AssessmentListPage from "@/pages/assessments/AssessmentListPage";
import AssessmentInvitePage from "@/pages/assessments/AssessmentInvitePage";
import LiveMonitorPage from "@/pages/monitor/LiveMonitorPage";
import TranscriptPage from "@/pages/transcript/TranscriptPage";
import VacancyListPage from "@/pages/vacancies/VacancyListPage";
import { assessmentsApi } from "@/services/assessments";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { useCoverageWebSocket } from "@/hooks/useCoverageWebSocket";
import { networkError } from "@/test/portfolioFixtures";
import { ASSESSMENT, SESSION, TURNS, VACANCY, expectPageStructure, ok, renderAt, renderInLayout } from "@/test/pageHarness";

vi.mock("@/services/assessments", () => ({ assessmentsApi: { list: vi.fn(), get: vi.fn(), getSessions: vi.fn(), createSession: vi.fn() } }));
vi.mock("@/services/vacancies", () => ({ vacanciesApi: { list: vi.fn() } }));
vi.mock("@/services/sessions", () => ({ sessionsApi: { get: vi.fn(), getTranscript: vi.fn(), endSession: vi.fn() } }));
vi.mock("@/hooks/useCoverageWebSocket", () => ({ useCoverageWebSocket: vi.fn() }));
// The assessments page also loads the review queue (slice 8); never over the network in tests.
vi.mock("@/services/reviewQueue", () => ({ reviewQueueApi: { list: vi.fn(() => new Promise(() => {})) } }));

beforeEach(() => {
    vi.mocked(assessmentsApi.list).mockResolvedValue(ok({ assessments: [ASSESSMENT] }));
    vi.mocked(assessmentsApi.get).mockResolvedValue(ok({ assessment: ASSESSMENT }));
    vi.mocked(assessmentsApi.getSessions).mockResolvedValue(ok({ sessions: [SESSION] }));
    vi.mocked(vacanciesApi.list).mockResolvedValue(ok({ vacancies: [VACANCY] }));
    vi.mocked(sessionsApi.get).mockResolvedValue(ok({ session: SESSION }));
    vi.mocked(sessionsApi.getTranscript).mockResolvedValue(ok({ turns: TURNS }));
    vi.mocked(useCoverageWebSocket).mockReturnValue({ coverageMap: null, sessionEnded: false, sessionEndReason: null, isConnected: true });
});
afterEach(() => vi.resetAllMocks());

describe.each([
    { path: "/assessments", route: "/assessments", element: <AssessmentListPage />, action: "New Assessment" },
    { path: "/assessments/1/invite", route: "/assessments/:id/invite", element: <AssessmentInvitePage />, action: "Invite Candidate", back: "Back to assessments" },
    { path: "/assessments/1/sessions/2/monitor", route: "/assessments/:id/sessions/:sessionId/monitor", element: <LiveMonitorPage />, action: "View portfolio", back: "Back to candidates" },
    { path: "/assessments/1/sessions/2/transcript", route: "/assessments/:id/sessions/:sessionId/transcript", element: <TranscriptPage />, action: "Download .txt", back: "Back to portfolio" },
    { path: "/vacancies", route: "/vacancies", element: <VacancyListPage />, action: "New Vacancy" },
    { path: "/halaman-tidak-ada", route: "*", element: <NotFoundPage />, action: "Go to assessments" },
])("page structure of $path", ({ path, route, element, action, back }) => {
    it("has main and nav landmarks, one h1 and a named main action", async () => {
        renderInLayout(path, route, element);
        await expectPageStructure(action, back);
    });
});

describe("page structure of /login", () => {
    it("has a main landmark, one h1 and a named sign in button", () => {
        render(<MemoryRouter><LoginPage /></MemoryRouter>);

        const main = screen.getByRole("main");
        expect(within(main).getAllByRole("heading", { level: 1 })).toHaveLength(1);
        expect(within(main).getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    });
});

// Lists used to show a plain red line and no way to retry; rows were cards
// with onClick that a keyboard could not reach.
describe("assessment and vacancy lists", () => {
    it("shows an error with a retry, then the list, and moves focus to the heading", async () => {
        vi.mocked(assessmentsApi.list).mockRejectedValueOnce(networkError).mockResolvedValueOnce(ok({ assessments: [ASSESSMENT] }));
        renderAt("/assessments", "/assessments", <AssessmentListPage />);

        const alert = await screen.findByRole("alert");
        expect(alert).toHaveTextContent("Could not load assessments");
        fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));

        expect(await screen.findByRole("link", { name: /Contoh Assessment Backend/ })).toHaveAttribute("href", "/assessments/1/invite");
        // The retry button is gone, so focus moves to the page heading, not <body>.
        expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1, name: "Assessments" }));
    });

    it("shows each assessment as a link with its created date and status", async () => {
        renderAt("/assessments", "/assessments", <AssessmentListPage />);

        const row = await screen.findByRole("link", { name: /Contoh Assessment Backend/ });
        expect(row).toHaveTextContent("Created 25 Oct 2026");
        expect(row).toHaveTextContent("Indonesian");
        expect(row).toHaveTextContent("Awaiting candidate");
    });

    it("explains an empty assessment list and links to create one", async () => {
        vi.mocked(assessmentsApi.list).mockResolvedValue(ok({ assessments: [] }));
        renderAt("/assessments", "/assessments", <AssessmentListPage />);

        expect(await screen.findByRole("heading", { name: "No assessments yet" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Create your first assessment" })).toHaveAttribute("href", "/assessments/new");
    });

    it("shows an error with a retry when vacancies fail to load", async () => {
        vi.mocked(vacanciesApi.list).mockRejectedValueOnce(networkError).mockResolvedValueOnce(ok({ vacancies: [VACANCY] }));
        renderAt("/vacancies", "/vacancies", <VacancyListPage />);

        fireEvent.click(within(await screen.findByRole("alert")).getByRole("button", { name: "Try again" }));

        const row = await screen.findByRole("link", { name: /Contoh Backend Engineer/ });
        expect(row).toHaveAttribute("href", "/vacancies/9/edit");
        expect(row).toHaveTextContent("Updated 25 Oct 2026");
        expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1, name: "Vacancies" }));
    });

    it("explains an empty vacancy list", async () => {
        vi.mocked(vacanciesApi.list).mockResolvedValue(ok({ vacancies: [] }));
        renderAt("/vacancies", "/vacancies", <VacancyListPage />);

        expect(await screen.findByRole("heading", { name: "No vacancies yet" })).toBeInTheDocument();
    });
});

describe("candidate list", () => {
    it("shows an error with a retry when the assessment fails to load", async () => {
        vi.mocked(assessmentsApi.get).mockRejectedValueOnce(networkError).mockResolvedValueOnce(ok({ assessment: ASSESSMENT }));
        vi.mocked(assessmentsApi.getSessions).mockResolvedValue(ok({ sessions: [] }));
        renderAt("/assessments/1/invite", "/assessments/:id/invite", <AssessmentInvitePage />);

        fireEvent.click(within(await screen.findByRole("alert")).getByRole("button", { name: "Try again" }));

        const heading = await screen.findByRole("heading", { level: 1, name: "Contoh Assessment Backend" });
        expect(document.activeElement).toBe(heading);
    });

    it("shows the start date in the shared format and an AA status colour", async () => {
        vi.mocked(assessmentsApi.getSessions).mockResolvedValue(ok({ sessions: [
            { ...SESSION, portfolio_status: "failed", review_summary: [{ code: "generation_failed", count: 1 }] },
        ] }));
        renderAt("/assessments/1/invite", "/assessments/:id/invite", <AssessmentInvitePage />);

        expect(await screen.findByText("Started 25 Oct 2026")).toBeInTheDocument();
        // A finished interview whose portfolio failed is not "Completed" (N15).
        expect(screen.getByText("Portfolio failed")).toHaveClass("text-red-800");
        expect(screen.queryByText("Completed")).not.toBeInTheDocument();
    });
});

describe("transcript", () => {
    it("shows an error with a retry, then the transcript", async () => {
        vi.mocked(sessionsApi.getTranscript).mockRejectedValueOnce(networkError).mockResolvedValueOnce(ok({ turns: TURNS }));
        renderAt("/assessments/1/sessions/2/transcript", "/assessments/:id/sessions/:sessionId/transcript", <TranscriptPage />);

        fireEvent.click(within(await screen.findByRole("alert")).getByRole("button", { name: "Try again" }));

        expect(await screen.findByText("Jawaban contoh.")).toBeInTheDocument();
        expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1, name: "Interview Transcript" }));
    });
});
