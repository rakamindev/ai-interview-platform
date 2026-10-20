import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function NotesField({ onChange }: { onChange?: (value: string) => void }) {
    const [value, setValue] = useState("");

    return (
        <>
            <Label htmlFor="candidate-notes">Interview notes</Label>
            <Textarea
                id="candidate-notes"
                value={value}
                onChange={(event) => {
                    setValue(event.target.value);
                    onChange?.(event.target.value);
                }}
            />
        </>
    );
}

describe("Textarea", () => {
    it("takes its accessible name from the label pointing at its id", () => {
        render(<NotesField />);

        const textarea = screen.getByLabelText("Interview notes");

        expect(textarea).toHaveAccessibleName("Interview notes");
        expect(textarea).toHaveAttribute("id", "candidate-notes");
    });

    it("reports every keystroke through onChange and shows the typed value", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();

        render(<NotesField onChange={onChange} />);
        await user.type(screen.getByLabelText("Interview notes"), "Solid");

        expect(screen.getByLabelText("Interview notes")).toHaveValue("Solid");
        expect(onChange.mock.calls).toEqual([["S"], ["So"], ["Sol"], ["Soli"], ["Solid"]]);
    });

    it("propagates rows, placeholder and the default value to the DOM", () => {
        render(
            <>
                <Label htmlFor="summary">Summary</Label>
                <Textarea
                    id="summary"
                    rows={6}
                    placeholder="Summarise the interview"
                    defaultValue="Pre-filled"
                />
            </>
        );

        const textarea = screen.getByLabelText("Summary");

        expect(textarea).toHaveAttribute("rows", "6");
        expect(textarea).toHaveAttribute("placeholder", "Summarise the interview");
        expect(textarea).toHaveValue("Pre-filled");
    });

    it("propagates disabled", () => {
        render(
            <>
                <Label htmlFor="frozen">Summary</Label>
                <Textarea id="frozen" disabled defaultValue="Locked" />
            </>
        );

        const textarea = screen.getByLabelText("Summary");

        expect(textarea).toBeDisabled();
        expect(textarea).toHaveAttribute("disabled");
    });

    it("propagates readOnly to the DOM element", () => {
        render(
            <>
                <Label htmlFor="readonly">Summary</Label>
                <Textarea id="readonly" readOnly defaultValue="Imported" />
            </>
        );

        const textarea = screen.getByLabelText("Summary") as HTMLTextAreaElement;

        expect(textarea).toHaveAttribute("readonly");
        expect(textarea.readOnly).toBe(true);
        expect(textarea).toBeEnabled();
        expect(textarea).toHaveValue("Imported");
    });
});
