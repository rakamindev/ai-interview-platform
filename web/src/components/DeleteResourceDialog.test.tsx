import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DeleteResourceDialog from "./DeleteResourceDialog";
import type { DeletionCheckResult } from "@/types";

function renderDialog(overrides: {
    resourceLabel?: string;
    resourceName?: string;
    checkEligibility?: () => Promise<DeletionCheckResult>;
    onConfirmDelete?: () => Promise<void>;
    onDeleted?: () => void;
} = {}) {
    const props = {
        resourceLabel: "vacancy",
        resourceName: "Backend Engineer",
        onConfirmDelete: vi.fn().mockResolvedValue(undefined),
        onDeleted: vi.fn(),
        ...overrides,
    };
    render(
        <MemoryRouter>
            <DeleteResourceDialog {...props} />
        </MemoryRouter>
    );
    return props;
}

describe("DeleteResourceDialog", () => {
    it("shows the blocked view with the blocking CV screening and no way to confirm", async () => {
        const checkEligibility = vi.fn().mockResolvedValue({
            deletable: false,
            reason: "cv_screenings",
            blocking_cv_screenings: [{ id: 7, name: "Backend Screening" }],
        });
        const { onConfirmDelete } = renderDialog({ checkEligibility });

        fireEvent.click(screen.getByText("Delete"));

        expect(await screen.findByText(/Can't delete this vacancy yet/)).toBeInTheDocument();
        expect(screen.getByText("Backend Screening")).toBeInTheDocument();
        expect(screen.getByText("View →")).toBeInTheDocument();
        expect(screen.queryByLabelText(/Type/)).not.toBeInTheDocument();
        expect(onConfirmDelete).not.toHaveBeenCalled();
    });

    it("shows a sessions-blocked message with no navigable list", async () => {
        const checkEligibility = vi.fn().mockResolvedValue({ deletable: false, reason: "sessions" });
        renderDialog({ resourceLabel: "assessment", checkEligibility });

        fireEvent.click(screen.getByText("Delete"));

        expect(await screen.findByText(/existing candidate sessions/)).toBeInTheDocument();
        expect(screen.queryByText("View →")).not.toBeInTheDocument();
    });

    it("keeps Confirm disabled until the typed name matches exactly, then deletes and navigates away", async () => {
        const { onConfirmDelete, onDeleted } = renderDialog();

        fireEvent.click(screen.getByText("Delete"));

        const input = await screen.findByLabelText(/Type/);
        const deleteButtons = screen.getAllByText("Delete");
        const confirmButton = deleteButtons[deleteButtons.length - 1];
        expect(confirmButton).toBeDisabled();

        fireEvent.change(input, { target: { value: "wrong name" } });
        expect(confirmButton).toBeDisabled();

        fireEvent.change(input, { target: { value: "Backend Engineer" } });
        expect(confirmButton).not.toBeDisabled();

        fireEvent.click(confirmButton);

        await waitFor(() => expect(onConfirmDelete).toHaveBeenCalled());
        await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    });

    it("skips the eligibility check entirely when none is provided", async () => {
        renderDialog({ checkEligibility: undefined });

        fireEvent.click(screen.getByText("Delete"));

        expect(await screen.findByLabelText(/Type/)).toBeInTheDocument();
    });

    it("shows an inline error and stays open if the delete call itself fails", async () => {
        const onConfirmDelete = vi.fn().mockRejectedValue(new Error("boom"));
        const onDeleted = vi.fn();
        renderDialog({ onConfirmDelete, onDeleted });

        fireEvent.click(screen.getByText("Delete"));
        const input = await screen.findByLabelText(/Type/);
        fireEvent.change(input, { target: { value: "Backend Engineer" } });
        const deleteButtons = screen.getAllByText("Delete");
        fireEvent.click(deleteButtons[deleteButtons.length - 1]);

        expect(await screen.findByText(/Failed to delete this vacancy/)).toBeInTheDocument();
        expect(onDeleted).not.toHaveBeenCalled();
    });
});
