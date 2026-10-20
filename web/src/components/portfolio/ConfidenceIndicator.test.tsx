import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ConfidenceIndicator from "@/components/portfolio/ConfidenceIndicator";

function renderConfidence(confidence: string) {
    render(<ConfidenceIndicator confidence={confidence} />);
}

describe("ConfidenceIndicator", () => {
    it("reports a high confidence reading as HIGH", () => {
        renderConfidence("high");

        expect(screen.getByText("Confidence: HIGH")).toBeInTheDocument();
        expect(screen.queryByText("Confidence: MEDIUM")).not.toBeInTheDocument();
        expect(screen.queryByText("Confidence: LOW")).not.toBeInTheDocument();
    });

    it("treats an already upper-cased value the same as a lower-cased one", () => {
        renderConfidence("HIGH");

        expect(screen.getByText("Confidence: HIGH")).toBeInTheDocument();
        expect(screen.queryByText("Confidence: LOW")).not.toBeInTheDocument();
    });

    it("reports a medium confidence reading as MEDIUM", () => {
        renderConfidence("medium");

        expect(screen.getByText("Confidence: MEDIUM")).toBeInTheDocument();
        expect(screen.queryByText("Confidence: HIGH")).not.toBeInTheDocument();
        expect(screen.queryByText("Confidence: LOW")).not.toBeInTheDocument();
    });

    it("reports a low confidence reading as LOW", () => {
        renderConfidence("low");

        expect(screen.getByText("Confidence: LOW")).toBeInTheDocument();
        expect(screen.queryByText("Confidence: HIGH")).not.toBeInTheDocument();
        expect(screen.queryByText("Confidence: MEDIUM")).not.toBeInTheDocument();
    });

    it.each([["weird"], ["almost-high"], ["HIGHEST"]])(
        "falls back to LOW for the unrecognised value %j",
        (confidence) => {
            renderConfidence(confidence);

            expect(screen.getByText("Confidence: LOW")).toBeInTheDocument();
            expect(screen.queryByText("Confidence: HIGH")).not.toBeInTheDocument();
            expect(screen.queryByText("Confidence: MEDIUM")).not.toBeInTheDocument();
        }
    );

    it("falls back to LOW when the API returns no confidence value at all", () => {
        renderConfidence(undefined as unknown as string);

        expect(screen.getByText("Confidence: LOW")).toBeInTheDocument();
        expect(screen.queryByText("Confidence: HIGH")).not.toBeInTheDocument();
        expect(screen.queryByText("Confidence: MEDIUM")).not.toBeInTheDocument();
    });
});
