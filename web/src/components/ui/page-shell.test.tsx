import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageShell } from "@/components/ui/page-shell";

// Every assessor page uses one of two widths instead of a different one each.
describe("PageShell", () => {
    it("centres the page at the default reading width", () => {
        render(<PageShell><p>Isi halaman</p></PageShell>);

        const shell = screen.getByText("Isi halaman").parentElement;
        expect(shell).toHaveClass("mx-auto", "max-w-5xl");
    });

    it("uses a narrower width for forms", () => {
        render(<PageShell width="narrow"><p>Isi form</p></PageShell>);

        const shell = screen.getByText("Isi form").parentElement;
        expect(shell).toHaveClass("max-w-3xl");
        expect(shell).not.toHaveClass("max-w-5xl");
    });

    it("does not add a second main landmark inside the layout", () => {
        render(<PageShell><p>Isi halaman</p></PageShell>);

        expect(screen.queryByRole("main")).not.toBeInTheDocument();
    });
});
