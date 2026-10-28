import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AssessmentListPage from "@/pages/assessments/AssessmentListPage";
import { assessmentsApi } from "@/services/assessments";
import { reviewQueueApi } from "@/services/reviewQueue";
import { ASSESSMENT, ok, renderAt } from "@/test/pageHarness";

vi.mock("@/services/assessments", () => ({ assessmentsApi: { list: vi.fn(), get: vi.fn(), getSessions: vi.fn(), createSession: vi.fn() } }));
vi.mock("@/services/reviewQueue", () => ({ reviewQueueApi: { list: vi.fn() } }));

const EMPTY_SUMMARY = { unreviewed_low_confidence: 0, unreviewed_not_assessed: 0, narrative_failed: 0, narrative_outdated: 0,
                        legacy_ratings: 0, generation_failed: 0, empty_portfolio: 0, portfolios: 0 };

function ended(id: number, name: string, portfolio_status: string, review_summary: unknown[]) {
    return { id, status: "ended", end_reason: "all_covered", candidate_name: name, started_at: "2026-10-25T08:00:00Z",
             invite_url: "", portfolio_status, review_summary };
}

beforeEach(() => {
    vi.mocked(reviewQueueApi.list).mockResolvedValue(ok({ summary: EMPTY_SUMMARY, items: [],
        meta: { current_page: 1, total_pages: 0, total_count: 0, per_page: 50 } }));
    vi.mocked(assessmentsApi.get).mockResolvedValue(ok({ assessment: ASSESSMENT }));
});
afterEach(() => vi.resetAllMocks());

describe("assessments page", () => {
    it("shows the Needs review section above the list (AC-105)", async () => {
        vi.mocked(assessmentsApi.list).mockResolvedValue(ok({ assessments: [ASSESSMENT] }));
        renderAt("/assessments", "/assessments", <AssessmentListPage />);

        expect(await screen.findByRole("region", { name: "Needs review" })).toBeInTheDocument();
    });

    it("shows how many candidates each assessment has and how many need review", async () => {
        vi.mocked(assessmentsApi.list).mockResolvedValue(ok({ assessments: [
            { ...ASSESSMENT, id: 1, name: "Contoh Assessment A", candidate_count: 12, needs_review_count: 6 },
            { ...ASSESSMENT, id: 2, name: "Contoh Assessment B", candidate_count: 3, needs_review_count: 0 },
            { ...ASSESSMENT, id: 3, name: "Contoh Assessment C", candidate_count: 0, needs_review_count: 0 },
        ] }));
        renderAt("/assessments", "/assessments", <AssessmentListPage />);

        const first = await screen.findByRole("link", { name: /Contoh Assessment A/ });
        expect(first).toHaveTextContent("12 candidates");
        expect(first).toHaveTextContent("6 need review");
        expect(screen.getByRole("link", { name: /Contoh Assessment B/ })).toHaveTextContent("All reviewed");
        expect(screen.getByRole("link", { name: /Contoh Assessment C/ })).toHaveTextContent("0 candidates");
        expect(screen.getByRole("link", { name: /Contoh Assessment C/ })).not.toHaveTextContent("All reviewed");
    });
});
