import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorState } from "@/components/ui/error-state";

describe("ErrorState", () => {
    it("is announced as an alert and retries on click", () => {
        const onRetry = vi.fn();
        render(<ErrorState title="Could not load the report" description="Server error." onRetry={onRetry} />);

        expect(screen.getByRole("alert")).toHaveTextContent("Could not load the report");
        fireEvent.click(screen.getByRole("button", { name: "Try again" }));
        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it("disables the retry button while retrying, so it cannot be clicked twice", () => {
        render(<ErrorState title="Offline" onRetry={vi.fn()} retrying />);

        expect(screen.getByRole("button", { name: "Trying again" })).toBeDisabled();
    });

    it("has no retry button without a handler", () => {
        render(<ErrorState title="Not found" />);

        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
});
