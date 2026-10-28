import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Callout } from "@/components/ui/callout";

describe("Callout", () => {
    it("is a note named by its title, with an icon, body and action", () => {
        render(
            <Callout variant="warning" title="Legacy portfolio" action={<button type="button">Open portfolio</button>}>
                Levels were generated before validation.
            </Callout>,
        );

        const note = screen.getByRole("note", { name: "Legacy portfolio" });
        expect(note).toHaveTextContent("Levels were generated before validation.");
        expect(note.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
        expect(screen.getByRole("button", { name: "Open portfolio" })).toBeInTheDocument();
    });

    it.each(["info", "warning", "error"] as const)("renders the %s variant", (variant) => {
        render(<Callout variant={variant} title={`Title ${variant}`} />);

        expect(screen.getByRole("note", { name: `Title ${variant}` })).toHaveAttribute("data-variant", variant);
    });
});
