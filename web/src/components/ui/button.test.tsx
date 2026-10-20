import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/button";

const VARIANTS = [
    "default",
    "destructive",
    "outline",
    "secondary",
    "ghost",
    "link",
] as const;

const SIZES = ["default", "sm", "lg", "icon"] as const;

describe("Button", () => {
    it("invokes onClick for a pointer activation", () => {
        const onClick = vi.fn();
        render(<Button onClick={onClick}>Submit answer</Button>);

        fireEvent.click(screen.getByRole("button", { name: "Submit answer" }));

        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("invokes onClick for a keyboard activation", async () => {
        const user = userEvent.setup();
        const onClick = vi.fn();
        render(<Button onClick={onClick}>Submit answer</Button>);

        const button = screen.getByRole("button", { name: "Submit answer" });
        button.focus();
        await user.keyboard("{Enter}");

        expect(onClick).toHaveBeenCalled();
    });

    it("never fires for a disabled button and reports itself disabled", () => {
        const onClick = vi.fn();
        render(
            <Button disabled onClick={onClick}>
                Submit answer
            </Button>
        );

        const button = screen.getByRole("button", { name: "Submit answer" });
        expect(button).toBeDisabled();

        fireEvent.click(button);

        expect(onClick).not.toHaveBeenCalled();
    });

    it.each(VARIANTS)("keeps the button role and accessible name for the %s variant", (variant) => {
        render(<Button variant={variant}>Confirm</Button>);

        const button = screen.getByRole("button", { name: "Confirm" });
        expect(button.tagName).toBe("BUTTON");
        expect(button).toBeEnabled();
    });

    it.each(SIZES)("keeps the button role and accessible name for the %s size", (size) => {
        render(<Button size={size}>Confirm</Button>);

        expect(screen.getByRole("button", { name: "Confirm" })).toBeEnabled();
    });

    it("renders its child through asChild while preserving the accessible name and click handler", () => {
        const onClick = vi.fn();
        render(
            <Button asChild onClick={onClick}>
                <a href="/assessments">Open assessments</a>
            </Button>
        );

        expect(screen.queryByRole("button")).not.toBeInTheDocument();
        const link = screen.getByRole("link", { name: "Open assessments" });
        expect(link).toHaveAttribute("href", "/assessments");

        fireEvent.click(link);

        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("keeps a disabled asChild element inert", () => {
        const onClick = vi.fn();
        render(
            <Button asChild disabled onClick={onClick}>
                <a href="/assessments">Open assessments</a>
            </Button>
        );

        const link = screen.getByRole("link", { name: "Open assessments" });
        expect(link).toHaveAttribute("aria-disabled", "true");
        expect(link).toHaveAttribute("tabindex", "-1");

        fireEvent.click(link);

        expect(onClick).not.toHaveBeenCalled();
    });
});
