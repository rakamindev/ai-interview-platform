import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";

describe("ConfidenceBadge", () => {
    it("shows the confidence with the probe count as text", () => {
        render(<ConfidenceBadge confidence="low" probeCount={1} />);

        expect(screen.getByRole("button", { name: "Low confidence, 1 probe" })).toBeInTheDocument();
    });

    it("pluralises probes and says when the count was not recorded", () => {
        const { rerender } = render(<ConfidenceBadge confidence="high" probeCount={3} />);
        expect(screen.getByRole("button", { name: "High confidence, 3 probes" })).toBeInTheDocument();

        rerender(<ConfidenceBadge confidence="medium" probeCount={null} />);
        expect(screen.getByRole("button", { name: "Medium confidence, probes not recorded" })).toBeInTheDocument();
    });

    it("explains the rule in a tooltip that also opens on keyboard focus", async () => {
        render(<ConfidenceBadge confidence="low" probeCount={1} />);

        await act(async () => { fireEvent.focus(screen.getByRole("button")); });

        expect((await screen.findAllByText(/how often the interview probed this skill/i)).length).toBeGreaterThan(0);
    });
});
