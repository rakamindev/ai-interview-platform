import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NeedsReviewSection from "@/components/review/NeedsReviewSection";
import { reviewQueueApi } from "@/services/reviewQueue";
import { networkError } from "@/test/portfolioFixtures";
import type { ReviewQueueItem } from "@/types";

vi.mock("@/services/reviewQueue", () => ({ reviewQueueApi: { list: vi.fn() } }));

const NOW = new Date("2026-10-26T12:00:00Z");
const SUMMARY = { unreviewed_low_confidence: 5, unreviewed_not_assessed: 5, narrative_failed: 1, narrative_outdated: 1,
                  legacy_ratings: 1, generation_failed: 1, empty_portfolio: 1, portfolios: 7 };

function item(id: number, overrides: Partial<ReviewQueueItem> = {}): ReviewQueueItem {
    return { portfolio_id: id, session_id: id + 100, assessment_id: 35, assessment_name: "Contoh Assessment Backend",
             candidate_name: `Kandidat Contoh ${id}`, reasons: [{ code: "unreviewed_low_confidence", count: 2 }],
             waiting_since: "2026-10-24T08:00:00Z", target: { page: "portfolio", vacancy_id: null }, ...overrides };
}

function respond(items: ReviewQueueItem[], summary = SUMMARY) {
    return { data: { summary, items, meta: { current_page: 1, total_pages: 1, total_count: items.length, per_page: 50 } } } as never;
}

function renderSection() {
    render(<MemoryRouter><NeedsReviewSection now={NOW} /></MemoryRouter>);
}

beforeEach(() => vi.mocked(reviewQueueApi.list).mockResolvedValue(respond([item(1)])));
afterEach(() => vi.resetAllMocks());

describe("NeedsReviewSection", () => {
    it("is a region named Needs review with one count per reason group (AC-105)", async () => {
        renderSection();

        const region = await screen.findByRole("region", { name: "Needs review" });
        expect(within(region).getByRole("button", { name: "Skills awaiting review: 10" })).toHaveAttribute("aria-pressed", "false");
        expect(within(region).getByRole("button", { name: "Narratives failed or outdated: 2" })).toBeInTheDocument();
        expect(within(region).getByRole("button", { name: "Legacy portfolios: 1" })).toBeInTheDocument();
        expect(within(region).getByRole("button", { name: "Portfolios failed or empty: 2" })).toBeInTheDocument();
    });

    it("shows each item with its reasons, waiting time and a Review link to the right page", async () => {
        vi.mocked(reviewQueueApi.list).mockResolvedValue(respond([
            item(1),
            item(2, { reasons: [{ code: "narrative_outdated", count: 1 }], target: { page: "fitgap", vacancy_id: 58 } }),
        ]));
        renderSection();

        const portfolioLink = await screen.findAllByRole("link", { name: "Review Kandidat Contoh 1" });
        expect(portfolioLink[0]).toHaveAttribute("href", "/assessments/35/sessions/101/portfolio");
        expect(screen.getAllByRole("link", { name: "Review Kandidat Contoh 2" })[0])
            .toHaveAttribute("href", "/assessments/35/sessions/102/fitgap/58");
        expect(screen.getAllByText("2 low confidence skills")[0]).toBeInTheDocument();
        expect(screen.getAllByText("Narrative outdated")[0]).toBeInTheDocument();
        expect(screen.getAllByText("waiting 2 days")[0]).toBeInTheDocument();
    });

    it("filters by a reason group from the keyboard and can be turned off again", async () => {
        renderSection();
        const card = await screen.findByRole("button", { name: "Legacy portfolios: 1" });

        card.focus();
        await act(async () => { fireEvent.click(card); });

        expect(reviewQueueApi.list).toHaveBeenLastCalledWith({ reason: "legacy", page: 1 });
        expect(card).toHaveAttribute("aria-pressed", "true");
        expect(document.activeElement).toBe(card);

        await act(async () => { fireEvent.click(card); });
        expect(reviewQueueApi.list).toHaveBeenLastCalledWith({ reason: undefined, page: 1 });
        expect(card).toHaveAttribute("aria-pressed", "false");
    });

    it("shows the five oldest items and the rest on request", async () => {
        vi.mocked(reviewQueueApi.list).mockResolvedValue(respond([1, 2, 3, 4, 5, 6, 7].map((id) => item(id))));
        renderSection();

        await screen.findAllByRole("link", { name: "Review Kandidat Contoh 5" });
        expect(screen.queryAllByRole("link", { name: "Review Kandidat Contoh 6" })).toHaveLength(0);

        const toggle = screen.getByRole("button", { name: "Show all 7" });
        toggle.focus();
        fireEvent.click(toggle);

        expect(screen.getAllByRole("link", { name: "Review Kandidat Contoh 7" }).length).toBeGreaterThan(0);
        expect(toggle).toHaveTextContent("Show fewer");
        expect(document.activeElement).toBe(toggle);
    });

    it("says so, positively, when nothing needs review", async () => {
        vi.mocked(reviewQueueApi.list).mockResolvedValue(respond([], { ...SUMMARY, unreviewed_low_confidence: 0,
            unreviewed_not_assessed: 0, narrative_failed: 0, narrative_outdated: 0, legacy_ratings: 0, generation_failed: 0,
            empty_portfolio: 0, portfolios: 0 }));
        renderSection();

        expect(await screen.findByRole("heading", { name: "Nothing needs review right now" })).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("shows an error with Try again and moves focus to the heading after a retry", async () => {
        vi.mocked(reviewQueueApi.list).mockRejectedValueOnce(networkError).mockResolvedValueOnce(respond([item(1)]));
        renderSection();

        const alert = await screen.findByRole("alert");
        expect(alert).toHaveTextContent("Could not load the review queue");
        await act(async () => { fireEvent.click(within(alert).getByRole("button", { name: "Try again" })); });

        await screen.findAllByRole("link", { name: "Review Kandidat Contoh 1" });
        expect(document.activeElement).toBe(screen.getByRole("heading", { level: 2, name: "Needs review" }));
    });

    it("shows a loading state while the queue loads", () => {
        vi.mocked(reviewQueueApi.list).mockReturnValue(new Promise(() => {}) as never);
        renderSection();

        expect(screen.getByLabelText("Loading the review queue")).toHaveAttribute("aria-busy", "true");
    });

    it("lets a very long candidate name wrap instead of overflowing", async () => {
        const longName = `Kandidat Contoh ${"Panjang ".repeat(30)}`.trim();
        vi.mocked(reviewQueueApi.list).mockResolvedValue(respond([item(1, { candidate_name: longName })]));
        renderSection();

        const names = await screen.findAllByText(longName);
        for (const name of names) expect(name).toHaveClass("[overflow-wrap:anywhere]");
    });
});
