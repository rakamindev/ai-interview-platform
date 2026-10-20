import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";

const SIDES = ["top", "right", "bottom", "left"] as const;

function renderSheet(side: (typeof SIDES)[number]) {
    return render(
        <Sheet>
            <SheetTrigger>Actions</SheetTrigger>
            <SheetContent side={side}>
                <SheetHeader>
                    <SheetTitle>Portfolio actions</SheetTitle>
                    <SheetDescription>Export or compare this portfolio.</SheetDescription>
                </SheetHeader>
                <button type="button">Run Fit/Gap Analysis</button>
            </SheetContent>
        </Sheet>
    );
}

describe("Sheet", () => {
    it("keeps its content out of the document until the trigger opens it", () => {
        renderSheet("bottom");

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.queryByText("Run Fit/Gap Analysis")).not.toBeInTheDocument();
    });

    it("opens as a named dialog containing the sheet content", () => {
        renderSheet("bottom");

        fireEvent.click(screen.getByRole("button", { name: "Actions" }));

        const dialog = screen.getByRole("dialog");
        expect(dialog).toHaveAccessibleName("Portfolio actions");
        expect(screen.getByText("Run Fit/Gap Analysis")).toBeInTheDocument();
        expect(dialog).toHaveAccessibleDescription("Export or compare this portfolio.");
    });

    it("closes on Escape", () => {
        renderSheet("bottom");

        fireEvent.click(screen.getByRole("button", { name: "Actions" }));
        expect(screen.getByRole("dialog")).toBeInTheDocument();

        fireEvent.keyDown(document.body, { key: "Escape" });

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it.each(SIDES)("renders its %s side without throwing", (side) => {
        renderSheet(side);

        fireEvent.click(screen.getByRole("button", { name: "Actions" }));

        expect(screen.getByRole("dialog")).toHaveAccessibleName("Portfolio actions");
    });
});
