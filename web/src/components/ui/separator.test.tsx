import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Separator } from "@/components/ui/separator";

describe("Separator", () => {
    it("is decorative by default and therefore removed from the accessibility tree", () => {
        render(<Separator data-testid="rule" />);

        expect(screen.queryByRole("separator")).toBeNull();
        expect(screen.getByTestId("rule")).toHaveAttribute("role", "none");
    });

    it("is a horizontal separator, implicitly, when made semantic", () => {
        render(<Separator decorative={false} data-testid="rule" />);

        const rule = screen.getByRole("separator");
        expect(rule).toBe(screen.getByTestId("rule"));
        expect(rule.getAttribute("aria-orientation") ?? "horizontal").toBe("horizontal");
        expect(rule).toHaveAttribute("data-orientation", "horizontal");
    });

    it("announces the vertical orientation when made semantic", () => {
        render(<Separator decorative={false} orientation="vertical" data-testid="rule" />);

        const rule = screen.getByRole("separator");
        expect(rule).toHaveAttribute("aria-orientation", "vertical");
        expect(rule).toHaveAttribute("data-orientation", "vertical");
    });

    it("keeps a vertical separator decorative when the caller leaves it decorative", () => {
        render(<Separator orientation="vertical" data-testid="rule" />);

        expect(screen.queryByRole("separator")).toBeNull();
        expect(screen.getByTestId("rule")).toHaveAttribute("data-orientation", "vertical");
    });
});
