import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AssessmentInvitePage from "@/pages/assessments/AssessmentInvitePage";
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

// Every finished row used to say "Completed" in green, including failed
// portfolios (N15). Rows now say what the portfolio is and what still needs
// a human (AC-106).
describe("candidate list", () => {
    const SESSIONS = [
        ended(1, "Kandidat Contoh Gagal", "failed", [{ code: "generation_failed", count: 1 }]),
        ended(2, "Kandidat Contoh Proses", "generating", []),
        ended(3, "Kandidat Contoh Terbuka", "ready", [{ code: "unreviewed_low_confidence", count: 3 }]),
        ended(4, "Kandidat Contoh Selesai", "ready", []),
    ];

    function row(name: string) {
        return screen.getByText(name).closest("li") as HTMLElement;
    }

    beforeEach(() => vi.mocked(assessmentsApi.getSessions).mockResolvedValue(ok({ sessions: SESSIONS })));

    it("says what each portfolio is and what still needs review", async () => {
        renderAt("/assessments/1/invite", "/assessments/:id/invite", <AssessmentInvitePage />);
        await screen.findByText("Kandidat Contoh Gagal");

        expect(row("Kandidat Contoh Gagal")).toHaveTextContent("Portfolio failed");
        expect(row("Kandidat Contoh Gagal")).not.toHaveTextContent("Completed");
        expect(row("Kandidat Contoh Proses")).toHaveTextContent("Generating");
        expect(row("Kandidat Contoh Terbuka")).toHaveTextContent("Portfolio ready");
        expect(row("Kandidat Contoh Terbuka")).toHaveTextContent("3 skills need review");
        expect(row("Kandidat Contoh Selesai")).toHaveTextContent("Reviewed");
        for (const badge of within(row("Kandidat Contoh Gagal")).getAllByText(/Portfolio failed/)) {
            expect(badge.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
        }
    });

    it("drops the meaningless row numbers", async () => {
        renderAt("/assessments/1/invite", "/assessments/:id/invite", <AssessmentInvitePage />);
        await screen.findByText("Kandidat Contoh Gagal");

        for (const name of ["Kandidat Contoh Gagal", "Kandidat Contoh Selesai"]) {
            expect(within(row(name)).queryByText(/^\d+$/)).not.toBeInTheDocument();
        }
    });

    it("can show only candidates that need review", async () => {
        renderAt("/assessments/1/invite", "/assessments/:id/invite", <AssessmentInvitePage />);
        await screen.findByText("Kandidat Contoh Gagal");

        const filter = screen.getByRole("button", { name: "Needs review" });
        // "All" was 40 px wide at 360 px; both filters keep a 44 px target.
        expect(screen.getByRole("button", { name: "All" })).toHaveClass("max-sm:min-w-11");
        fireEvent.click(filter);

        expect(filter).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByText("Kandidat Contoh Terbuka")).toBeInTheDocument();
        expect(screen.getByText("Kandidat Contoh Gagal")).toBeInTheDocument();
        expect(screen.queryByText("Kandidat Contoh Selesai")).not.toBeInTheDocument();
        expect(screen.queryByText("Kandidat Contoh Proses")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "All" }));
        expect(screen.getByText("Kandidat Contoh Selesai")).toBeInTheDocument();
    });
});
