import { render, screen } from "@testing-library/react";
import { Check } from "lucide-react";
import { describe, expect, it } from "vitest";
import { StatCard } from "@/components/ui/stat-card";

describe("StatCard", () => {
    it("exposes the label and value as one accessible group", () => {
        render(<StatCard label="Match" value={3} icon={Check} tone="positive" />);

        const card = screen.getByRole("group", { name: "Match: 3" });
        expect(card).toHaveTextContent("Match");
        expect(card).toHaveTextContent("3");
        expect(card.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    });

    it("renders a zero value instead of hiding it", () => {
        render(<StatCard label="Gap" value={0} icon={Check} />);

        expect(screen.getByRole("group", { name: "Gap: 0" })).toBeInTheDocument();
    });
});
