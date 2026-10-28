import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "@/components/ui/status-badge";

// Status is shown as text plus an icon, never colour alone.
describe("StatusBadge", () => {
    it.each(["success", "warning", "danger", "info", "neutral"] as const)("renders the %s tone with text and a hidden icon", (tone) => {
        render(<StatusBadge tone={tone}>{`Status ${tone}`}</StatusBadge>);

        const badge = screen.getByText(`Status ${tone}`);
        expect(badge.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    });

    it("uses darker text than the old green-600 and amber-600 labels", () => {
        render(
            <>
                <StatusBadge tone="success">Completed</StatusBadge>
                <StatusBadge tone="warning">Awaiting candidate</StatusBadge>
            </>,
        );

        expect(screen.getByText("Completed")).toHaveClass("text-green-800");
        expect(screen.getByText("Awaiting candidate")).toHaveClass("text-amber-900");
    });
});
