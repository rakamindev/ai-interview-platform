import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

describe("Label", () => {
    it("names the input whose id it points at", () => {
        render(
            <>
                <Label htmlFor="candidate-email">Candidate email</Label>
                <Input id="candidate-email" />
            </>
        );

        const input = screen.getByLabelText("Candidate email");

        expect(input).toHaveAccessibleName("Candidate email");
        expect(input).toHaveAttribute("id", "candidate-email");
    });

    it("activates the control it points at when clicked", () => {
        render(
            <>
                <Label htmlFor="consent">I agree to the recording notice</Label>
                <input id="consent" type="checkbox" />
            </>
        );

        const checkbox = screen.getByRole("checkbox");
        expect(checkbox).not.toBeChecked();

        fireEvent.click(screen.getByText("I agree to the recording notice"));

        expect(checkbox).toBeChecked();
    });

    it("activates the matching option of a radio group whose ids are generated", () => {
        render(
            <>
                <input id="first-level-1" type="radio" name="first-level" defaultChecked />
                <input id="first-level-2" type="radio" name="first-level" />
                <input id="first-level-3" type="radio" name="first-level" />
                <Label htmlFor="first-level-3">L3</Label>
            </>
        );

        fireEvent.click(screen.getByText("L3"));

        const radios = screen.getAllByRole("radio");
        expect(radios[2]).toBeChecked();
        expect(radios[0]).not.toBeChecked();
    });

    it("forwards its ref to the rendered label element", () => {
        const ref = createRef<HTMLLabelElement>();

        render(<Label ref={ref}>Candidate email</Label>);

        expect(ref.current).not.toBeNull();
        expect(ref.current?.tagName).toBe("LABEL");
        expect(ref.current).toBe(screen.getByText("Candidate email"));
    });
});
