import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import VoiceBars from "@/components/interview/VoiceBars";

describe("VoiceBars", () => {
    it("names the speaker and draws five bars while idle", () => {
        const { container } = render(<VoiceBars active={false} label="Listening…" />);

        expect(screen.getByText("Listening…")).toBeInTheDocument();
        expect(container.firstElementChild!.children).toHaveLength(2);
        expect(container.firstElementChild!.firstElementChild!.children).toHaveLength(5);
    });

    it("keeps the label and the bar count when the speaker becomes active", () => {
        const { container, rerender } = render(<VoiceBars active={false} label="Listening…" />);
        expect(container.firstElementChild!.firstElementChild!.children).toHaveLength(5);

        rerender(<VoiceBars active label="Listening…" />);

        expect(screen.getByText("Listening…")).toBeInTheDocument();
        expect(container.firstElementChild!.firstElementChild!.children).toHaveLength(5);
    });

    it("renders the same structure for the ai and candidate variants", () => {
        const { container, rerender } = render(<VoiceBars active label="Rakamin AI" variant="ai" />);

        expect(screen.getByText("Rakamin AI")).toBeInTheDocument();
        expect(container.firstElementChild!.firstElementChild!.children).toHaveLength(5);

        rerender(<VoiceBars active label="You" variant="candidate" />);

        expect(screen.getByText("You")).toBeInTheDocument();
        expect(screen.queryByText("Rakamin AI")).not.toBeInTheDocument();
        expect(container.firstElementChild!.firstElementChild!.children).toHaveLength(5);
    });
});
