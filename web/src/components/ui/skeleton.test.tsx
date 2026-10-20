import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Skeleton } from "@/components/ui/skeleton";

describe("Skeleton", () => {
    it("renders an empty placeholder element", () => {
        render(<Skeleton data-testid="skeleton" />);

        const skeleton = screen.getByTestId("skeleton");
        expect(skeleton).toBeEmptyDOMElement();
        expect(skeleton.textContent).toBe("");
    });

    it("carries the caller's aria and data attributes through to the DOM", () => {
        render(
            <Skeleton
                data-testid="skeleton"
                aria-hidden="true"
                data-slot="portfolio-loading"
                data-state="pending"
            />
        );

        const skeleton = screen.getByTestId("skeleton");
        expect(skeleton).toHaveAttribute("aria-hidden", "true");
        expect(skeleton).toHaveAttribute("data-slot", "portfolio-loading");
        expect(skeleton).toHaveAttribute("data-state", "pending");
    });

    it("renders its children inside the placeholder", () => {
        render(
            <Skeleton data-testid="skeleton" aria-hidden="true">
                Loading portfolio
            </Skeleton>
        );

        const skeleton = screen.getByTestId("skeleton");
        expect(skeleton).toContainElement(screen.getByText("Loading portfolio"));
        expect(skeleton).toHaveTextContent("Loading portfolio");
    });

    it("hides its whole subtree from assistive technology when aria-hidden is set", () => {
        const onHiddenClick = vi.fn();
        render(
            <Skeleton data-testid="skeleton" aria-hidden="true">
                <button type="button" onClick={onHiddenClick}>
                    Regenerate
                </button>
            </Skeleton>
        );

        expect(screen.queryByRole("button", { name: "Regenerate" })).toBeNull();
        fireEvent.click(screen.getByText("Regenerate"));
        expect(onHiddenClick).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId("skeleton")).toHaveAttribute("aria-hidden", "true");
    });
});
