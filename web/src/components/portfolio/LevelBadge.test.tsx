import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import LevelBadge from "@/components/portfolio/LevelBadge";

describe("LevelBadge", () => {
    it("labels each supported level with its L-number", () => {
        render(
            <div>
                {[1, 2, 3, 4, 5].map((level) => (
                    <LevelBadge key={level} level={level} />
                ))}
            </div>
        );

        ["L1", "L2", "L3", "L4", "L5"].forEach((label) => {
            expect(screen.getByText(label)).toBeInTheDocument();
        });
    });

    it("names the level in words at the medium size", () => {
        render(<LevelBadge level={3} />);

        expect(screen.getByText("L3")).toBeInTheDocument();
        expect(screen.getByText("Proficient")).toBeInTheDocument();
    });

    it("defaults to the medium size and its description", () => {
        render(<LevelBadge level={5} />);

        expect(screen.getByText("L5")).toBeInTheDocument();
        expect(screen.getByText("Expert")).toBeInTheDocument();
    });

    it("omits the description at the small size", () => {
        render(<LevelBadge level={3} size="sm" />);

        expect(screen.getByText("L3")).toBeInTheDocument();
        expect(screen.queryByText("Proficient")).not.toBeInTheDocument();
    });

    it("renders an unknown level without inventing a label or description", () => {
        const { container } = render(<LevelBadge level={9} />);

        expect(container.querySelector("div")).toBeInTheDocument();
        expect(screen.queryByText(/^L\d$/)).not.toBeInTheDocument();
        expect(screen.queryByText("Expert")).not.toBeInTheDocument();
        expect(screen.queryByText("Foundational")).not.toBeInTheDocument();
    });
});
