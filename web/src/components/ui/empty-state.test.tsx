import { render, screen } from "@testing-library/react";
import { Inbox } from "lucide-react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "@/components/ui/empty-state";

describe("EmptyState", () => {
    it("shows a heading, a description and an action", () => {
        render(
            <EmptyState icon={Inbox} title="This vacancy has no required skills"
                        description="Add skills to compare." action={<a href="/vacancies/1/edit">Add skills</a>} />,
        );

        expect(screen.getByRole("heading", { name: "This vacancy has no required skills" })).toBeInTheDocument();
        expect(screen.getByText("Add skills to compare.")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Add skills" })).toBeInTheDocument();
    });

    it("can be the page's h1 when it is the whole page", () => {
        render(<EmptyState title="Page not found" headingLevel={1} />);

        expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
    });
});
