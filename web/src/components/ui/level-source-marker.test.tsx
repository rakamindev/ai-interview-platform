import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LevelSourceMarker } from "@/components/ui/level-source-marker";

const override = { action: "override" as const, ai_level: 2, notes: "Contoh: tugas tertulis.", actor_id: 7,
                   at: "2026-10-25T08:00:00.000Z" };

describe("LevelSourceMarker", () => {
    it("names an assessor override with the AI level it replaced", () => {
        render(<LevelSourceMarker source="assessor_override" aiLevel={2} review={override} />);

        expect(screen.getByText("Assessor override (AI L2)")).toBeInTheDocument();
    });

    it("says when the AI had no level before the override", () => {
        render(<LevelSourceMarker source="assessor_override" aiLevel={null} review={{ ...override, ai_level: null }} />);

        expect(screen.getByText("Assessor override (AI not assessed)")).toBeInTheDocument();
    });

    it("shows who reviewed, when (UTC) and the note in the detailed variant", () => {
        render(<LevelSourceMarker source="assessor_override" aiLevel={2} review={override} variant="detailed" />);

        expect(screen.getByText("Assessor #7, 25 Oct 2026, 08:00 UTC")).toBeInTheDocument();
        expect(screen.getByText("Contoh: tugas tertulis.")).toBeInTheDocument();
    });

    it("marks a confirmed AI level and an unreviewed AI level", () => {
        const { rerender } = render(
            <LevelSourceMarker source="assessor_confirmed" aiLevel={3}
                               review={{ ...override, action: "confirm", ai_level: 3, notes: null }} variant="detailed" />,
        );
        expect(screen.getByText("Confirmed by assessor")).toBeInTheDocument();
        expect(screen.getByText("No note")).toBeInTheDocument();

        rerender(<LevelSourceMarker source="ai" aiLevel={3} review={null} />);
        expect(screen.getByText("AI rating, not reviewed")).toBeInTheDocument();
    });

    it("renders nothing when there is no level source", () => {
        const { container } = render(<LevelSourceMarker source={null} aiLevel={null} review={null} />);

        expect(container).toBeEmptyDOMElement();
    });
});
