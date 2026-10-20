import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function NamedInput({ onChange }: { onChange?: (value: string) => void }) {
    const [value, setValue] = useState("");

    return (
        <>
            <Label htmlFor="candidate-name">Candidate name</Label>
            <Input
                id="candidate-name"
                value={value}
                onChange={(event) => {
                    setValue(event.target.value);
                    onChange?.(event.target.value);
                }}
            />
        </>
    );
}

describe("Input", () => {
    it("takes its accessible name from the label pointing at its id", () => {
        render(<NamedInput />);

        const input = screen.getByLabelText("Candidate name");

        expect(input).toHaveAccessibleName("Candidate name");
        expect(input).toHaveAttribute("id", "candidate-name");
    });

    it("reports every keystroke through onChange and shows the typed value", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();

        render(<NamedInput onChange={onChange} />);
        await user.type(screen.getByLabelText("Candidate name"), "Ada");

        expect(screen.getByLabelText("Candidate name")).toHaveValue("Ada");
        expect(onChange.mock.calls).toEqual([["A"], ["Ad"], ["Ada"]]);
    });

    it("updates a controlled value when the field is changed programmatically", () => {
        render(<NamedInput />);

        const input = screen.getByLabelText("Candidate name");
        fireEvent.change(input, { target: { value: "Grace Hopper" } });

        expect(input).toHaveValue("Grace Hopper");
    });

    it("sends the type prop to the DOM and defaults to a text field", () => {
        render(
            <>
                <Label htmlFor="pin">PIN</Label>
                <Input id="pin" type="password" />
                <Label htmlFor="plain">Search</Label>
                <Input id="plain" />
            </>
        );

        expect(screen.getByLabelText("PIN")).toHaveAttribute("type", "password");
        expect((screen.getByLabelText("Search") as HTMLInputElement).type).toBe("text");
    });

    it("propagates disabled and keeps a disabled field uneditable", () => {
        render(
            <>
                <Label htmlFor="locked">Candidate name</Label>
                <Input id="locked" disabled defaultValue="Fixed" />
            </>
        );

        const input = screen.getByLabelText("Candidate name");

        expect(input).toBeDisabled();
        expect(input).toHaveAttribute("disabled");
        expect(input).toHaveValue("Fixed");
    });

    it("propagates readOnly to the DOM element", () => {
        render(
            <>
                <Label htmlFor="readonly">Candidate name</Label>
                <Input id="readonly" readOnly defaultValue="Imported" />
            </>
        );

        const input = screen.getByLabelText("Candidate name") as HTMLInputElement;

        expect(input).toHaveAttribute("readonly");
        expect(input.readOnly).toBe(true);
        expect(input).toBeEnabled();
        expect(input).toHaveValue("Imported");
    });

    it("propagates placeholder and aria-invalid", () => {
        render(
            <>
                <Label htmlFor="email">Email</Label>
                <Input id="email" placeholder="you@example.com" aria-invalid="true" />
            </>
        );

        const input = screen.getByLabelText("Email");

        expect(input).toHaveAttribute("placeholder", "you@example.com");
        expect(input).toHaveAttribute("aria-invalid", "true");
        expect(input).toBeInvalid();
    });
});
