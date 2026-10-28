import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResultBadge } from "@/components/ui/result-badge";

describe("ResultBadge", () => {
    it.each([
        ["match", 0, "Match"],
        ["exceed", 2, "Exceeds +2"],
        ["gap", -1, "Gap -1"],
    ] as const)("labels %s with its icon and delta", (result, delta, text) => {
        const { container } = render(<ResultBadge result={result} delta={delta} />);

        expect(screen.getByText(text)).toBeInTheDocument();
        expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    });

    it("says that not assessed is not counted", () => {
        render(<ResultBadge result="not_assessed" delta={null} />);

        expect(screen.getByText("Not assessed")).toBeInTheDocument();
        expect(screen.getByText("Not counted")).toBeInTheDocument();
    });

    it("gives the tentative direction of a low-confidence level and says it is not counted", () => {
        render(<ResultBadge result="low_confidence" delta={1} tentativeDirection="above" />);

        expect(screen.getByText("Low confidence")).toBeInTheDocument();
        expect(screen.getByText("Tentatively above, not counted")).toBeInTheDocument();
    });
});
