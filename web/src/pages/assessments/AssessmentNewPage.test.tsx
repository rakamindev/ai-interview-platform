import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AssessmentNewPage from "./AssessmentNewPage";

vi.mock("@/services/assessments", () => ({
    assessmentsApi: { create: vi.fn() },
}));

function renderNewPage() {
    render(
        <MemoryRouter>
            <AssessmentNewPage />
        </MemoryRouter>,
    );
}

describe("AssessmentNewPage", () => {
    it("tells the assessor that skill names must be unique", () => {
        renderNewPage();

        expect(screen.getByText(/Each skill needs its own name/)).toBeInTheDocument();
    });

    it("shows a failed save in a dismissible alert", async () => {
        renderNewPage();

        await userEvent.type(screen.getByLabelText(/Role title/), "Jr. Backend Engineer");
        await userEvent.click(screen.getByRole("button", { name: /Save/ }));

        expect(await screen.findByRole("alert")).toHaveTextContent("Add at least one skill to continue.");

        await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));

        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(screen.getByLabelText(/Role title/)).toHaveValue("Jr. Backend Engineer");
    });
});
