import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Progress } from "@/components/ui/progress";

/**
 * DEFECT (web/src/components/ui/progress.tsx:11): `value` is destructured out of the props and
 * never forwarded to `ProgressPrimitive.Root`, so the rendered bar is always indeterminate and
 * its `value` is only used to translate the inner indicator. The tests below pin the current DOM
 * contract; they turn red as soon as `value` is passed through to the root.
 */
describe("Progress", () => {
    it("renders a bar for value 0 without exposing the value as aria-valuenow", () => {
        render(<Progress value={0} />);

        const bar = screen.getByRole("progressbar");
        expect(bar).not.toHaveAttribute("aria-valuenow");
        expect(bar).not.toHaveAttribute("aria-valuetext");
        expect(bar).toHaveAttribute("data-state", "indeterminate");
    });

    it("renders a bar for value 100 without exposing the value as aria-valuenow", () => {
        render(<Progress value={100} />);

        const bar = screen.getByRole("progressbar");
        expect(bar).not.toHaveAttribute("aria-valuenow");
        expect(bar).toHaveAttribute("data-state", "indeterminate");
    });

    it("keeps aria-valuemin at 0 and defaults aria-valuemax to 100", () => {
        render(<Progress value={40} />);

        const bar = screen.getByRole("progressbar");
        expect(bar).toHaveAttribute("aria-valuemin", "0");
        expect(bar).toHaveAttribute("aria-valuemax", "100");
        expect(bar).toHaveAttribute("data-max", "100");
    });

    it("sends a caller-supplied max through to the DOM", () => {
        render(<Progress value={5} max={10} />);

        const bar = screen.getByRole("progressbar");
        expect(bar).toHaveAttribute("aria-valuemax", "10");
        expect(bar).toHaveAttribute("data-max", "10");
    });

    it("renders an indeterminate bar when no value is supplied", () => {
        render(<Progress />);

        const bar = screen.getByRole("progressbar");
        expect(bar).not.toHaveAttribute("aria-valuenow");
        expect(bar).toHaveAttribute("data-state", "indeterminate");
    });

    it("names the bar when the caller supplies a label", () => {
        render(<Progress value={12} aria-label="Portfolio generation" />);

        expect(screen.getByRole("progressbar", { name: "Portfolio generation" })).toBeInTheDocument();
    });
});
