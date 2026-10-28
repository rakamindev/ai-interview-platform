import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RevertOverrideDialog from "@/components/portfolio/RevertOverrideDialog";
import { portfoliosApi } from "@/services/portfolios";
import { httpError, overrideFixture, skillFixture } from "@/test/portfolioFixtures";

vi.mock("@/services/portfolios", () => ({ portfoliosApi: { revertOverride: vi.fn() } }));

const overridden = skillFixture({ effective_level: 3, level_source: "assessor_override" });

function open(skill = overridden) {
    const onReverted = vi.fn();
    render(<RevertOverrideDialog skill={skill} override={overrideFixture()} onReverted={onReverted} />);
    fireEvent.click(screen.getByRole("button", { name: "Undo override for Contoh SQL" }));
    return { onReverted };
}

// AC-23: undoing an override goes back to the AI level, needs a note and
// keeps the history.
describe("RevertOverrideDialog", () => {
    afterEach(() => vi.clearAllMocks());

    it("explains the effect in an alert dialog", async () => {
        open();

        const dialog = await screen.findByRole("alertdialog", { name: "Undo the override for Contoh SQL?" });
        expect(dialog).toHaveTextContent("goes back to the AI rating (L2)");
        expect(dialog).toHaveTextContent("stays in the review history");
    });

    it("says when the skill goes back to not assessed", () => {
        open(skillFixture({ ai_level: null, ai_confidence: null, rating_status: "not_assessed", effective_level: 3,
                            level_source: "assessor_override" }));

        expect(screen.getByRole("alertdialog")).toHaveTextContent("goes back to Not assessed");
    });

    it("requires a note and sends it", async () => {
        vi.mocked(portfoliosApi.revertOverride).mockResolvedValue({ data: { override: null } } as never);
        const { onReverted } = open();

        const confirm = within(screen.getByRole("alertdialog")).getByRole("button", { name: "Undo override" });
        expect(confirm).toBeDisabled();
        fireEvent.change(screen.getByLabelText(/reason for undoing/i), { target: { value: "Contoh: salah input." } });
        fireEvent.click(confirm);

        await waitFor(() => expect(onReverted).toHaveBeenCalled());
        expect(portfoliosApi.revertOverride).toHaveBeenCalledWith(1, "Contoh: salah input.");
    });

    it("stays open with the input when undoing fails", async () => {
        vi.mocked(portfoliosApi.revertOverride).mockRejectedValue(httpError(500));
        open();

        fireEvent.change(screen.getByLabelText(/reason for undoing/i), { target: { value: "Contoh." } });
        fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Undo override" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("Could not undo the override. Try again.");
        expect(screen.getByLabelText(/reason for undoing/i)).toHaveValue("Contoh.");
    });
});
