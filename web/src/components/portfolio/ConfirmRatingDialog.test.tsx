import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ConfirmRatingDialog from "@/components/portfolio/ConfirmRatingDialog";
import { portfoliosApi } from "@/services/portfolios";
import { httpError, skillFixture } from "@/test/portfolioFixtures";

vi.mock("@/services/portfolios", () => ({ portfoliosApi: { confirmRating: vi.fn() } }));

function open(skill = skillFixture()) {
    const onConfirmed = vi.fn();
    render(<ConfirmRatingDialog skill={skill} onConfirmed={onConfirmed} />);
    fireEvent.click(screen.getByRole("button", { name: "Confirm AI rating for Contoh SQL" }));
    return { onConfirmed };
}

const lowConfidence = skillFixture({ ai_confidence: "low", coverage: { state: "partial", probe_count: 1 } });

// AC-30: confirming moves a skill into the fit/gap totals; a low-confidence
// rating can only be confirmed with a note (backend code note_required).
describe("ConfirmRatingDialog", () => {
    afterEach(() => vi.clearAllMocks());

    it("explains that confirming counts the skill toward fit/gap", async () => {
        open();

        expect(await screen.findByRole("dialog", { name: "Confirm the AI rating: Contoh SQL" })).toBeInTheDocument();
        expect(screen.getByText(/counts toward the fit\/gap totals/i)).toBeInTheDocument();
    });

    it("requires a note for a low-confidence rating", () => {
        open(lowConfidence);

        const note = screen.getByLabelText(/note \(required for a low-confidence rating\)/i);
        const confirm = screen.getByRole("button", { name: "Confirm rating" });
        expect(note).toBeRequired();
        expect(screen.getByText(/low-confidence ratings are not counted/i)).toBeInTheDocument();
        expect(confirm).toBeDisabled();

        fireEvent.change(note, { target: { value: "  " } });
        expect(confirm).toBeDisabled();
        fireEvent.change(note, { target: { value: "Contoh: bukti tambahan." } });
        expect(confirm).toBeEnabled();
    });

    it("lets a high-confidence rating be confirmed without a note", async () => {
        vi.mocked(portfoliosApi.confirmRating).mockResolvedValue({ data: {} } as never);
        const { onConfirmed } = open();

        expect(screen.getByLabelText(/note \(optional\)/i)).not.toBeRequired();
        fireEvent.click(screen.getByRole("button", { name: "Confirm rating" }));

        await waitFor(() => expect(onConfirmed).toHaveBeenCalled());
        expect(portfoliosApi.confirmRating).toHaveBeenCalledWith(1, "");
    });

    it("shows the server note_required error instead of failing silently", async () => {
        vi.mocked(portfoliosApi.confirmRating).mockRejectedValue(
            httpError(422, { errors: [{ status: 422, code: "note_required", message: "A note is required to confirm a low-confidence rating" }] }));
        open();

        fireEvent.click(screen.getByRole("button", { name: "Confirm rating" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("A note is required to confirm a low-confidence rating");
    });

    it("cannot be submitted twice", () => {
        vi.mocked(portfoliosApi.confirmRating).mockReturnValue(new Promise(() => {}) as never);
        open();

        const confirm = screen.getByRole("button", { name: "Confirm rating" });
        fireEvent.click(confirm);
        fireEvent.click(confirm);

        expect(portfoliosApi.confirmRating).toHaveBeenCalledTimes(1);
    });
});
