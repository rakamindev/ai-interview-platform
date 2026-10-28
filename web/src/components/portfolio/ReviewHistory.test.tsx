import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ReviewHistory from "@/components/portfolio/ReviewHistory";
import { portfoliosApi } from "@/services/portfolios";
import { httpError, skillFixture } from "@/test/portfolioFixtures";

vi.mock("@/services/portfolios", () => ({ portfoliosApi: { getOverrideEvents: vi.fn() } }));

const EVENTS = [
    { id: 3, action: "revert", from_level: 3, to_level: 2, ai_level_at_time: 2, notes: "Contoh: salah input.", actor_id: 9, created_at: "2026-10-25T09:00:00.000Z" },
    { id: 2, action: "set", from_level: 2, to_level: 3, ai_level_at_time: 2, notes: "Contoh: tugas tertulis.", actor_id: 7, created_at: "2026-10-25T08:00:00.000Z" },
    { id: 1, action: "confirm", from_level: 2, to_level: 2, ai_level_at_time: 2, notes: null, actor_id: 7, created_at: "2026-10-24T07:30:00.000Z" },
];

function open() {
    render(<ReviewHistory skill={skillFixture()} />);
    fireEvent.click(screen.getByRole("button", { name: "Review history for Contoh SQL" }));
}

// The append-only review trail of one skill, newest first.
describe("ReviewHistory", () => {
    afterEach(() => vi.clearAllMocks());

    it("lists override, undo and confirm events with levels, notes, assessor and UTC time", async () => {
        vi.mocked(portfoliosApi.getOverrideEvents).mockResolvedValue({ data: { events: EVENTS } } as never);
        open();

        const items = await screen.findAllByRole("listitem");
        expect(items.map((item) => item.querySelector("p")?.textContent)).toEqual([
            "Override undone, back to L2", "Assessor override, from L2 to L3", "AI rating confirmed at L2",
        ]);
        expect(screen.getByText("Assessor #9, 25 Oct 2026, 09:00 UTC")).toBeInTheDocument();
        expect(screen.getByText("Contoh: tugas tertulis.")).toBeInTheDocument();
        expect(screen.getByText("No note")).toBeInTheDocument();
    });

    it("says when nobody has reviewed the skill yet", async () => {
        vi.mocked(portfoliosApi.getOverrideEvents).mockResolvedValue({ data: { events: [] } } as never);
        open();

        expect(await screen.findByText("No assessor review yet.")).toBeInTheDocument();
    });

    it("offers Try again when the history cannot be loaded", async () => {
        vi.mocked(portfoliosApi.getOverrideEvents).mockRejectedValueOnce(httpError(500))
            .mockResolvedValue({ data: { events: EVENTS } } as never);
        open();

        fireEvent.click(await screen.findByRole("button", { name: "Try again" }));

        expect(await screen.findAllByRole("listitem")).toHaveLength(3);
    });

    it("wraps a 2,000-character note instead of overflowing", async () => {
        const long = "n".repeat(2000);
        vi.mocked(portfoliosApi.getOverrideEvents).mockResolvedValue({ data: { events: [{ ...EVENTS[1], notes: long }] } } as never);
        open();

        expect(await screen.findByText(long)).toHaveClass("[overflow-wrap:anywhere]");
    });
});
