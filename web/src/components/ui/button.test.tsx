import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./button";

describe("Button", () => {
    it("calls onClick when clicked", async () => {
        const onClick = vi.fn();
        render(<Button onClick={onClick}>Save</Button>);

        await userEvent.click(screen.getByRole("button", { name: "Save" }));

        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("does not call onClick when disabled", async () => {
        const onClick = vi.fn();
        render(<Button onClick={onClick} disabled>Save</Button>);

        await userEvent.click(screen.getByRole("button", { name: "Save" }));

        expect(onClick).not.toHaveBeenCalled();
    });
});
