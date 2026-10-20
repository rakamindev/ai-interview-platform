import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ErrorBoundary from "@/components/ErrorBoundary";

function ThrowingChild(): JSX.Element {
    throw new Error("synthetic render failure");
}

/**
 * jsdom exposes `window.location.reload` as a non-configurable own property, so the
 * spy has to replace `window.location` (which is configurable) with a borrowed clone.
 */
function stubReload(reload: () => void) {
    const original = Object.getOwnPropertyDescriptor(window, "location");
    const stub = Object.create(window.location) as Location;
    Object.defineProperty(stub, "reload", { configurable: true, value: reload });
    Object.defineProperty(window, "location", {
        configurable: true,
        writable: true,
        value: stub,
    });

    return () => {
        Object.defineProperty(window, "location", original as PropertyDescriptor);
    };
}

describe("ErrorBoundary", () => {
    it("replaces a child that throws during render with the fallback and drops the child's content", () => {
        vi.spyOn(console, "error").mockImplementation(() => {});

        render(
            <ErrorBoundary>
                <p>Fragile panel</p>
                <ThrowingChild />
            </ErrorBoundary>
        );

        expect(screen.queryByText("Fragile panel")).not.toBeInTheDocument();
        expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
    });

    it("renders a healthy child untouched and shows no fallback", () => {
        render(
            <ErrorBoundary>
                <p>Healthy panel</p>
            </ErrorBoundary>
        );

        expect(screen.getByText("Healthy panel")).toBeInTheDocument();
        expect(screen.queryByText("Something went wrong.")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Refresh" })).not.toBeInTheDocument();
    });

    it("reloads the page when the fallback Refresh button is pressed", () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const reload = vi.fn();
        const restore = stubReload(reload);

        try {
            render(
                <ErrorBoundary>
                    <ThrowingChild />
                </ErrorBoundary>
            );

            const refresh = screen.getByRole("button", { name: "Refresh" });
            expect(reload).not.toHaveBeenCalled();

            fireEvent.click(refresh);

            expect(reload).toHaveBeenCalledTimes(1);
        } finally {
            restore();
        }
    });
});
