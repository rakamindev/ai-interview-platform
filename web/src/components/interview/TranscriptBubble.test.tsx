import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import TranscriptBubble from "@/components/interview/TranscriptBubble";

type Speaker = "candidate" | "assessor" | "system" | "ai";

describe("TranscriptBubble", () => {
    it("labels the candidate's own words as You", () => {
        render(<TranscriptBubble speaker="candidate" text="I led the migration myself." />);

        const bubble = screen.getByText("I led the migration myself.");
        expect(within(bubble).getByText("You")).toBeInTheDocument();
        expect(within(bubble).queryByText("AI")).not.toBeInTheDocument();
    });

    it.each<Speaker>(["ai", "assessor", "system"])("labels the %s speaker as AI", (speaker) => {
        render(<TranscriptBubble speaker={speaker} text="Tell me about your last outage." />);

        const bubble = screen.getByText("Tell me about your last outage.");
        expect(within(bubble).getByText("AI")).toBeInTheDocument();
        expect(within(bubble).queryByText("You")).not.toBeInTheDocument();
    });

    it("keeps the speaker label attached to the utterance it belongs to", () => {
        render(
            <div>
                <TranscriptBubble speaker="ai" text="Why did you choose Postgres?" />
                <TranscriptBubble speaker="candidate" text="Because we needed transactions." />
            </div>
        );

        const question = screen.getByText("Why did you choose Postgres?");
        const answer = screen.getByText("Because we needed transactions.");

        expect(within(question).getByText("AI")).toBeInTheDocument();
        expect(within(question).queryByText("You")).not.toBeInTheDocument();
        expect(within(answer).getByText("You")).toBeInTheDocument();
        expect(within(answer).queryByText("AI")).not.toBeInTheDocument();

        expect(screen.getAllByText("AI")).toHaveLength(1);
        expect(screen.getAllByText("You")).toHaveLength(1);
    });
});
