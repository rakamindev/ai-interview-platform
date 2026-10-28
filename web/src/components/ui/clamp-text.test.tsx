import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ClampText } from "@/components/ui/clamp-text";

describe("ClampText", () => {
    it("shows short text without a toggle", () => {
        render(<ClampText text="Contoh pendek." />);

        expect(screen.getByText("Contoh pendek.")).toBeInTheDocument();
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("clamps long text and expands it with a keyboard-reachable button", () => {
        const long = "x".repeat(5_000);
        render(<ClampText text={long} lines={3} />);

        const text = screen.getByText(long);
        const toggle = screen.getByRole("button", { name: "Show more" });
        expect(text).toHaveClass("line-clamp-3");
        expect(toggle).toHaveAttribute("aria-expanded", "false");
        expect(toggle).toHaveAttribute("aria-controls", text.id);

        fireEvent.click(toggle);

        expect(screen.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");
        expect(text).not.toHaveClass("line-clamp-3");
    });

    it("can name the expand button after what it expands", () => {
        render(<ClampText text={"z".repeat(300)} expandLabel="Show full name" />);

        expect(screen.getByRole("button", { name: "Show full name" })).toBeInTheDocument();
    });

    it("breaks long unbroken strings instead of overflowing", () => {
        render(<ClampText text={"y".repeat(255)} />);

        expect(screen.getByText("y".repeat(255))).toHaveClass("[overflow-wrap:anywhere]");
    });
});
