import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import AssessorLayout from "@/components/layout/AssessorLayout";

function renderLayout() {
    render(
        <MemoryRouter initialEntries={["/assessments"]}>
            <AssessorLayout />
        </MemoryRouter>,
    );
}

// At 390 px the header used to be 550 px wide and pushed every assessor page
// sideways. Below sm, labels become screen-reader-only (icons stay) so the
// header fits, and the accessible names do not change.
describe("AssessorLayout header on small screens", () => {
    it("keeps the accessible names of the navigation and logout", () => {
        renderLayout();

        expect(screen.getByRole("link", { name: "Assessments" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Vacancies" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Rakamin AI Interview" })).toBeInTheDocument();
    });

    it("hides the visible labels below sm instead of letting them overflow", () => {
        renderLayout();

        for (const name of ["Assessments", "Vacancies"]) {
            expect(within(screen.getByRole("link", { name })).getByText(name)).toHaveClass("max-sm:sr-only");
        }
        expect(within(screen.getByRole("button", { name: "Logout" })).getByText("Logout")).toHaveClass("max-sm:sr-only");
        expect(screen.getByText("Rakamin AI Interview")).toHaveClass("max-sm:sr-only");
    });
});
