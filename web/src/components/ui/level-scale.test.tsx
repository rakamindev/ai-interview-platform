import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LevelScale } from "@/components/ui/level-scale";

function steps() {
    return Array.from(document.querySelectorAll("[data-level-step]"));
}

describe("LevelScale", () => {
    it("describes required and candidate levels in words for screen readers", () => {
        render(<LevelScale required={3} candidate={2} />);

        expect(screen.getByRole("img", { name: "Required L3, candidate L2" })).toBeInTheDocument();
    });

    it("marks levels by shape, not only colour: filled up to the candidate, a tick at the requirement", () => {
        render(<LevelScale required={3} candidate={2} />);

        expect(steps()).toHaveLength(5);
        expect(steps().map((s) => s.getAttribute("data-filled"))).toEqual(["true", "true", "false", "false", "false"]);
        expect(steps().map((s) => s.hasAttribute("data-required"))).toEqual([false, false, true, false, false]);
    });

    it("shows no filled level when the candidate was not assessed", () => {
        render(<LevelScale required={4} candidate={null} />);

        expect(screen.getByRole("img", { name: "Required L4, candidate not assessed" })).toBeInTheDocument();
        expect(steps().every((s) => s.getAttribute("data-filled") === "false")).toBe(true);
    });

    it("works without a requirement, for the portfolio where no vacancy is chosen", () => {
        const { rerender } = render(<LevelScale candidate={3} />);
        expect(screen.getByRole("img", { name: "Level L3" })).toBeInTheDocument();
        expect(steps().some((s) => s.hasAttribute("data-required"))).toBe(false);

        rerender(<LevelScale candidate={null} />);
        expect(screen.getByRole("img", { name: "Not assessed" })).toBeInTheDocument();
    });
});
