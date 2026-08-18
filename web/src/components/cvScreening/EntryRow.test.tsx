import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import EntryRow from "./EntryRow";
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
        render(<EntryRow entry={buildEntry()} index={1} onReview={vi.fn()} reviewing={false} />);

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
            />
        );

        expect(screen.getByText("Score: 62")).toBeInTheDocument();
        fireEvent.click(screen.getByText("Invite"));
        expect(onReview).toHaveBeenCalledWith(1, "invite");

        fireEvent.click(screen.getByText("Reject"));
        expect(onReview).toHaveBeenCalledWith(1, "reject");
    });

    it("renders an invited entry with no review actions", () => {
        render(
            <EntryRow
                entry={buildEntry({ decision: "invited", score: 85 })}
                index={1}
                onReview={vi.fn()}
                reviewing={false}
            />
        );

        expect(screen.getByText("Invited")).toBeInTheDocument();
        expect(screen.queryByText("Invite")).not.toBeInTheDocument();
    });

    it("falls back to a placeholder when no email was detected", () => {
        render(
            <EntryRow
                entry={buildEntry({ detected_email: null })}
                index={1}
                onReview={vi.fn()}
                reviewing={false}
            />
        );

        expect(screen.getByText("No email detected")).toBeInTheDocument();
    });
});
