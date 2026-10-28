import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { PageHeader } from "@/components/ui/page-header";

function renderHeader(ui: React.ReactElement) {
    render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("PageHeader", () => {
    it("renders one h1, a description and the actions", () => {
        renderHeader(
            <PageHeader title="Assessments" description="Interviews you can send to candidates."
                        actions={<button type="button">New Assessment</button>} />,
        );

        expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
        expect(screen.getByRole("heading", { level: 1, name: "Assessments" })).toBeInTheDocument();
        expect(screen.getByText("Interviews you can send to candidates.")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "New Assessment" })).toBeInTheDocument();
    });

    it("names the back link with its destination, not only an arrow icon", () => {
        renderHeader(<PageHeader title="Edit Vacancy" back={{ to: "/vacancies", label: "Back to vacancies" }} />);

        const link = screen.getByRole("link", { name: "Back to vacancies" });
        expect(link).toHaveAttribute("href", "/vacancies");
        expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    });

    it("renders no back link or actions when none are given", () => {
        renderHeader(<PageHeader title="Vacancies" />);

        expect(screen.queryByRole("link")).not.toBeInTheDocument();
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("forwards a ref to the h1 so a page can move focus to it", () => {
        const ref = createRef<HTMLHeadingElement>();
        renderHeader(<PageHeader ref={ref} title="Portfolio" />);

        ref.current?.focus();
        expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1, name: "Portfolio" }));
    });
});
