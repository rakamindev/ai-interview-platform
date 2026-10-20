import { createRef, type ForwardRefExoticComponent, type RefAttributes } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge, type BadgeProps } from "@/components/ui/badge";

describe("Badge", () => {
    it("renders its children as text", () => {
        render(<Badge>Overdue</Badge>);

        const badge = screen.getByText("Overdue");
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveTextContent("Overdue");
    });

    it("keeps the same accessible text no matter which variant is used", () => {
        const variants: NonNullable<BadgeProps["variant"]>[] = [
            "default",
            "secondary",
            "destructive",
            "outline",
        ];

        render(
            <div>
                {variants.map((variant) => (
                    <Badge key={variant} variant={variant}>
                        Overdue
                    </Badge>
                ))}
            </div>
        );

        const badges = screen.getAllByText("Overdue");
        expect(badges).toHaveLength(variants.length);
        for (const badge of badges) {
            expect(badge.textContent).toBe("Overdue");
            expect(badge).not.toHaveAttribute("aria-label");
            expect(badge).not.toHaveAttribute("aria-hidden");
        }
    });

    // DEFECT (web/src/components/ui/badge.tsx:26): Badge is a plain function component with no
    // forwardRef, so a ref handed to it never reaches the rendered div. This test pins the
    // current behaviour; it flips to red the moment ref forwarding is added.
    it("does not forward a ref to its DOM element", () => {
        const ref = createRef<HTMLDivElement>();
        const RefBadge = Badge as unknown as ForwardRefExoticComponent<
            BadgeProps & RefAttributes<HTMLDivElement>
        >;

        render(<RefBadge ref={ref}>Overdue</RefBadge>);

        expect(ref.current).toBeNull();
        expect(screen.getByText("Overdue").tagName).toBe("DIV");
    });
});
