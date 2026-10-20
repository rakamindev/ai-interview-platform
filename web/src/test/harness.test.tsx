import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/button";

describe("test harness", () => {
    it("renders a component and dispatches a real click through userEvent", async () => {
        const onClick = vi.fn();
        const user = userEvent.setup();

        render(
            <Button variant="outline" size="sm" onClick={onClick}>
                Retry check
            </Button>
        );

        const button = screen.getByRole("button", { name: "Retry check" });
        expect(button).toBeEnabled();

        await user.click(button);

        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("keeps a disabled button inert for keyboard and pointer activation", async () => {
        const onClick = vi.fn();
        const user = userEvent.setup();

        render(
            <Button disabled onClick={onClick}>
                Start Interview
            </Button>
        );

        const button = screen.getByRole("button", { name: "Start Interview" });
        expect(button).toBeDisabled();

        await user.click(button);

        expect(onClick).not.toHaveBeenCalled();
    });
});
