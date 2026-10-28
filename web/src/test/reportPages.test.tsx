import { beforeEach, describe, it, vi } from "vitest";
import PortfolioPage from "@/pages/portfolio/PortfolioPage";
import FitGapReportPage from "@/pages/fitgap/FitGapReportPage";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { skillFixture } from "@/test/portfolioFixtures";
import { SESSION, VACANCY, expectPageStructure, ok, renderInLayout } from "@/test/pageHarness";

vi.mock("@/services/sessions", () => ({ sessionsApi: { get: vi.fn(), getPortfolio: vi.fn(), regeneratePortfolio: vi.fn() } }));
vi.mock("@/services/vacancies", () => ({ vacanciesApi: { list: vi.fn() } }));
vi.mock("@/services/portfolios", () => ({
    portfoliosApi: { getFitGap: vi.fn(), triggerFitGap: vi.fn(), regenerateFitGap: vi.fn(), exportPortfolio: vi.fn(),
                     getOverride: vi.fn(), confirmRating: vi.fn(), revertOverride: vi.fn(), getOverrideEvents: vi.fn() },
}));

const REPORT = {
    portfolio_id: 5, vacancy_id: 9, role_title: VACANCY.role_title,
    summary: { total: 1, evidenced: 1, match: 1, exceed: 0, gap: 0, not_assessed: 0, low_confidence: 0, overridden: 0, confirmed: 0 },
    comparisons: [{ skill_label: "Contoh Rails", expected_level: 3, candidate_level: 3, ai_level: 3, level_source: "ai",
                    is_override: false, confidence: "high", result: "match", delta: 0, counts_toward_fit: true }],
    follow_up: [],
    narrative: { status: "complete", source: "ai", label: "AI generated, not a hiring decision", culture: null, overall: "Contoh narasi." },
};

beforeEach(() => {
    vi.mocked(sessionsApi.get).mockResolvedValue(ok({ session: SESSION }));
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValue(ok({ portfolio: {
        id: 5, session_id: 2, generation_status: "complete", ratings_validated: true,
        skills: [skillFixture({ id: 1, skill_label: "Contoh Rails" })], overrides: [],
    } }));
    vi.mocked(portfoliosApi.getFitGap).mockResolvedValue(ok({ report: REPORT }));
    vi.mocked(vacanciesApi.list).mockResolvedValue(ok({ vacancies: [VACANCY] }));
});

// Portfolio and Fit/Gap keep their 6a/6b content; only the header moves to PageHeader.
describe.each([
    { path: "/assessments/1/sessions/2/portfolio", route: "/assessments/:id/sessions/:sessionId/portfolio", element: <PortfolioPage />, back: "Back to candidates" },
    { path: "/assessments/1/sessions/2/fitgap/9", route: "/assessments/:id/sessions/:sessionId/fitgap/:vacancyId", element: <FitGapReportPage />, back: "Back to portfolio" },
])("page structure of $path", ({ path, route, element, back }) => {
    it("has main and nav landmarks, one h1, Export PDF and a named back link", async () => {
        renderInLayout(path, route, element);
        await expectPageStructure("Export PDF", back);
    });
});
