import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import EntryRow from "./EntryRow";
import { cvScreeningsApi } from "@/services/cvScreenings";
import type { CvScreeningEntry } from "@/types";

function buildEntry(overrides: Partial<CvScreeningEntry> = {}): CvScreeningEntry {
    return {
        id: 1,
        cv_screening_batch_id: 1,
        detected_email: "jordan.example@test.invalid",
        decision: "pending",
        decision_reason: null,
        score: null,
        filename: "cv.pdf",
        ...overrides,
    };
}

describe("EntryRow", () => {
    it("shows a processing indicator for a pending entry, with no review actions", () => {
        render(
            <EntryRow
                entry={buildEntry()}
                index={1}
                onReview={vi.fn()}
                reviewing={false}
                onReanalyze={vi.fn()}
                reanalyzing={false}
                onCancel={vi.fn()}
                cancelling={false}
            />
        );

        expect(screen.getByText("Processing")).toBeInTheDocument();
        expect(screen.queryByText("Invite")).not.toBeInTheDocument();
        expect(screen.queryByText("Reject")).not.toBeInTheDocument();
    });

    it("shows invite/reject actions and the score only for a needs_review entry", () => {
        const onReview = vi.fn();
        render(
            <EntryRow
                entry={buildEntry({ decision: "needs_review", score: 62 })}
                index={1}
                onReview={onReview}
                reviewing={false}
                onReanalyze={vi.fn()}
                reanalyzing={false}
                onCancel={vi.fn()}
                cancelling={false}
            />
        );

        expect(screen.getByText("Score: 62")).toBeInTheDocument();
        fireEvent.click(screen.getByText("Invite"));
        expect(onReview).toHaveBeenCalledWith(1, "invite");

        fireEvent.click(screen.getByText("Reject"));
        expect(onReview).toHaveBeenCalledWith(1, "reject");
    });

    it("has no Download button — Preview covers viewing the CV", () => {
        render(
            <EntryRow
                entry={buildEntry({ decision: "needs_review" })}
                index={1}
                onReview={vi.fn()}
                reviewing={false}
                onReanalyze={vi.fn()}
                reanalyzing={false}
                onCancel={vi.fn()}
                cancelling={false}
            />
        );

        expect(screen.queryByTitle("Download original file")).not.toBeInTheDocument();
    });

    it("keeps the Preview button as the last action, after Invite/Reject", () => {
        render(
            <EntryRow
                entry={buildEntry({ decision: "needs_review" })}
                index={1}
                onReview={vi.fn()}
                reviewing={false}
                onReanalyze={vi.fn()}
                reanalyzing={false}
                onCancel={vi.fn()}
                cancelling={false}
            />
        );

        const buttons = screen.getAllByRole("button");
        expect(buttons[buttons.length - 1]).toHaveAttribute("title", "Preview CV");
    });

    it("renders an invited entry with no review actions", () => {
        render(
            <EntryRow
                entry={buildEntry({ decision: "invited", score: 85 })}
                index={1}
                onReview={vi.fn()}
                reviewing={false}
                onReanalyze={vi.fn()}
                reanalyzing={false}
                onCancel={vi.fn()}
                cancelling={false}
            />
        );

        expect(screen.getByText("Invited")).toBeInTheDocument();
        expect(screen.queryByText("Invite")).not.toBeInTheDocument();
    });

    it("shows a Re-analyze action only when the entry failed to analyze, not for other needs_review reasons", () => {
        const onReanalyze = vi.fn();
        const { rerender } = render(
            <EntryRow
                entry={buildEntry({ decision: "needs_review", decision_reason: "model_failed" })}
                index={1}
                onReview={vi.fn()}
                reviewing={false}
                onReanalyze={onReanalyze}
                reanalyzing={false}
                onCancel={vi.fn()}
                cancelling={false}
            />
        );

        fireEvent.click(screen.getByText("Re-analyze"));
        expect(onReanalyze).toHaveBeenCalledWith(1);
        expect(screen.getByText("Analysis failed")).toBeInTheDocument();
        expect(screen.queryByText("Needs review")).not.toBeInTheDocument();
        expect(screen.queryByText("Invite")).not.toBeInTheDocument();
        expect(screen.queryByText("Reject")).not.toBeInTheDocument();

        rerender(
            <EntryRow
                entry={buildEntry({ decision: "needs_review", decision_reason: "below_private_threshold" })}
                index={1}
                onReview={vi.fn()}
                reviewing={false}
                onReanalyze={onReanalyze}
                reanalyzing={false}
                onCancel={vi.fn()}
                cancelling={false}
            />
        );

        expect(screen.queryByText("Re-analyze")).not.toBeInTheDocument();
        expect(screen.getByText("Needs review")).toBeInTheDocument();
        expect(screen.queryByText("Analysis failed")).not.toBeInTheDocument();
        expect(screen.getByText("Invite")).toBeInTheDocument();
        expect(screen.getByText("Reject")).toBeInTheDocument();
    });

    it("shows a Cancel action for a pending entry, and calls onCancel with the entry id", () => {
        const onCancel = vi.fn();
        render(
            <EntryRow
                entry={buildEntry({ decision: "pending" })}
                index={1}
                onReview={vi.fn()}
                reviewing={false}
                onReanalyze={vi.fn()}
                reanalyzing={false}
                onCancel={onCancel}
                cancelling={false}
            />
        );

        fireEvent.click(screen.getByText("Cancel"));
        expect(onCancel).toHaveBeenCalledWith(1);
    });

    it("also shows Re-analyze for an entry cancelled out of a stuck pending state", () => {
        render(
            <EntryRow
                entry={buildEntry({ decision: "needs_review", decision_reason: "cancelled" })}
                index={1}
                onReview={vi.fn()}
                reviewing={false}
                onReanalyze={vi.fn()}
                reanalyzing={false}
                onCancel={vi.fn()}
                cancelling={false}
            />
        );

        expect(screen.getByText("Re-analyze")).toBeInTheDocument();
        expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
        expect(screen.getByText("Analysis failed")).toBeInTheDocument();
        expect(screen.queryByText("Invite")).not.toBeInTheDocument();
        expect(screen.queryByText("Reject")).not.toBeInTheDocument();
    });

    it("opens an email dialog instead of calling onReview when the entry has no detected email", () => {
        const onReview = vi.fn();
        render(
            <EntryRow
                entry={buildEntry({ decision: "needs_review", detected_email: null })}
                index={1}
                onReview={onReview}
                reviewing={false}
                onReanalyze={vi.fn()}
                reanalyzing={false}
                onCancel={vi.fn()}
                cancelling={false}
            />
        );

        fireEvent.click(screen.getByText("Invite"));
        expect(onReview).not.toHaveBeenCalled();
        expect(screen.getByText("Email required")).toBeInTheDocument();
    });

    it("keeps Confirm disabled until a valid email is entered, then calls onReview with it", () => {
        const onReview = vi.fn();
        render(
            <EntryRow
                entry={buildEntry({ decision: "needs_review", detected_email: null })}
                index={1}
                onReview={onReview}
                reviewing={false}
                onReanalyze={vi.fn()}
                reanalyzing={false}
                onCancel={vi.fn()}
                cancelling={false}
            />
        );

        fireEvent.click(screen.getByText("Invite"));
        const confirmButton = screen.getByText("Confirm");
        expect(confirmButton).toBeDisabled();

        const input = screen.getByPlaceholderText("candidate@example.com");
        fireEvent.change(input, { target: { value: "not-an-email" } });
        expect(confirmButton).toBeDisabled();

        fireEvent.change(input, { target: { value: "jordan.example@test.invalid" } });
        expect(confirmButton).not.toBeDisabled();

        fireEvent.click(confirmButton);
        expect(onReview).toHaveBeenCalledWith(1, "invite", "jordan.example@test.invalid");
    });

    it("calls onReview immediately with no dialog when the entry already has a detected email", () => {
        const onReview = vi.fn();
        render(
            <EntryRow
                entry={buildEntry({ decision: "needs_review" })}
                index={1}
                onReview={onReview}
                reviewing={false}
                onReanalyze={vi.fn()}
                reanalyzing={false}
                onCancel={vi.fn()}
                cancelling={false}
            />
        );

        fireEvent.click(screen.getByText("Invite"));
        expect(onReview).toHaveBeenCalledWith(1, "invite");
        expect(screen.queryByText("Email required")).not.toBeInTheDocument();
    });

    it("opens the CV directly in a new tab when Preview is clicked", async () => {
        const blob = new Blob(["%PDF-1.4"], { type: "application/pdf" });
        const fetchSpy = vi.spyOn(cvScreeningsApi, "fetchFileBlob").mockResolvedValue(blob);
        vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:mock-url") });
        const fakeTab = { location: { href: "" }, close: vi.fn() } as unknown as Window;
        const openSpy = vi.spyOn(window, "open").mockReturnValue(fakeTab);

        render(
            <EntryRow
                entry={buildEntry()}
                index={1}
                onReview={vi.fn()}
                reviewing={false}
                onReanalyze={vi.fn()}
                reanalyzing={false}
                onCancel={vi.fn()}
                cancelling={false}
            />
        );

        fireEvent.click(screen.getByTitle("Preview CV"));

        // The tab opens synchronously, in the same gesture as the click, so it
        // isn't popup-blocked — before the async fetch below has resolved.
        expect(openSpy).toHaveBeenCalledWith("", "_blank");

        await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith(1));
        await waitFor(() => expect(fakeTab.location.href).toBe("blob:mock-url"));

        vi.unstubAllGlobals();
    });

    it("falls back to a placeholder when no email was detected", () => {
        render(
            <EntryRow
                entry={buildEntry({ detected_email: null })}
                index={1}
                onReview={vi.fn()}
                reviewing={false}
                onReanalyze={vi.fn()}
                reanalyzing={false}
                onCancel={vi.fn()}
                cancelling={false}
            />
        );

        expect(screen.getByText("No email detected")).toBeInTheDocument();
    });
});
