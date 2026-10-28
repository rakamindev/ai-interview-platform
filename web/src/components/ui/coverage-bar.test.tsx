import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CoverageBar } from "@/components/ui/coverage-bar";

describe("CoverageBar", () => {
    it("states the coverage in text and as a labelled progress bar", () => {
        render(<CoverageBar value={3} total={5} label="required skills have evidence" />);

        expect(screen.getByText("3 of 5 required skills have evidence")).toBeInTheDocument();
        const bar = screen.getByRole("progressbar", { name: "3 of 5 required skills have evidence" });
        expect(bar).toHaveAttribute("aria-valuenow", "60");
    });

    it("handles an empty total without dividing by zero", () => {
        render(<CoverageBar value={0} total={0} label="required skills have evidence" />);

        expect(screen.getByRole("progressbar", { name: "0 of 0 required skills have evidence" }))
            .toHaveAttribute("aria-valuenow", "0");
    });
});
