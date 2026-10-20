import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import LevelRadio from "@/components/assessment/LevelRadio";

function TwoGroups({ onChange }: { onChange: (which: "first" | "second", level: number) => void }) {
    const [first, setFirst] = useState(1);
    const [second, setSecond] = useState(1);

    return (
        <div>
            <LevelRadio
                name="first"
                label="Expected level for React"
                value={first}
                onChange={(level) => {
                    setFirst(level);
                    onChange("first", level);
                }}
            />
            <LevelRadio
                name="second"
                label="Expected level for SQL"
                value={second}
                onChange={(level) => {
                    setSecond(level);
                    onChange("second", level);
                }}
            />
        </div>
    );
}

describe("LevelRadio", () => {
    it("generates unique ids for every group rendered on one page", () => {
        render(<TwoGroups onChange={vi.fn()} />);

        const ids = Array.from(document.querySelectorAll("[id^='first-level-'], [id^='second-level-']")).map(
            (node) => node.id
        );

        expect(ids).toHaveLength(10);
        expect(new Set(ids).size).toBe(10);
        expect(ids).toContain("first-level-1");
        expect(ids).toContain("second-level-5");
    });

    it("changes only the group whose label was pressed", () => {
        const onChange = vi.fn();
        render(<TwoGroups onChange={onChange} />);

        const secondGroup = screen.getByRole("radiogroup", { name: "Expected level for SQL" });
        fireEvent.click(within(secondGroup).getByText("L3"));

        expect(onChange).toHaveBeenCalledWith("second", 3);
        expect(within(secondGroup).getAllByRole("radio")[2]).toBeChecked();

        const firstGroup = screen.getByRole("radiogroup", { name: "Expected level for React" });
        expect(within(firstGroup).getAllByRole("radio")[0]).toBeChecked();
    });

    it("exposes every level as a focusable, named option", () => {
        render(<TwoGroups onChange={vi.fn()} />);

        const group = screen.getByRole("radiogroup", { name: "Expected level for React" });
        const radios = within(group).getAllByRole("radio");

        expect(radios).toHaveLength(5);
        expect(radios[2]).toHaveAccessibleName("L3");
        expect(radios[4]).toHaveAccessibleName("L5");
        expect(radios[0]).toBeChecked();

        radios[3].focus();
        expect(radios[3]).toHaveFocus();
    });
});
