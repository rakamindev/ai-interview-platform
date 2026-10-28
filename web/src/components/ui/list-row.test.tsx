import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ListRow } from "@/components/ui/list-row";

function renderRow(ui: React.ReactElement) {
    render(<MemoryRouter><ul>{ui}</ul></MemoryRouter>);
}

// The old rows were cards with onClick, so a keyboard user could not reach them.
describe("ListRow", () => {
    it("is one list item holding a real link to the detail page", () => {
        renderRow(<ListRow to="/assessments/3/invite" title="Contoh Assessment Backend" />);

        expect(screen.getByRole("listitem")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /Contoh Assessment Backend/ })).toHaveAttribute("href", "/assessments/3/invite");
    });

    it("shows meta and status inside the link", () => {
        renderRow(<ListRow to="/vacancies/2/edit" title="Contoh Backend Engineer"
                           meta={<span>Updated 25 Oct 2026</span>} status={<span>4 skills</span>} />);

        const link = screen.getByRole("link");
        expect(link).toHaveTextContent("Updated 25 Oct 2026");
        expect(link).toHaveTextContent("4 skills");
    });

    it("keeps the chevron out of the accessible name", () => {
        renderRow(<ListRow to="/vacancies/2/edit" title="Contoh Backend Engineer" />);

        for (const icon of screen.getByRole("link").querySelectorAll("svg")) {
            expect(icon).toHaveAttribute("aria-hidden", "true");
        }
    });
});
