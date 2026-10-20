import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ConnectionStatus from "@/components/interview/ConnectionStatus";

type State = "connected" | "reconnecting" | "lost";

const STATES: Array<[State, string]> = [
    ["connected", "Connected"],
    ["reconnecting", "Reconnecting..."],
    ["lost", "Connection lost"],
];

const ALL_TEXTS = STATES.map(([, text]) => text);

describe("ConnectionStatus", () => {
    it.each(STATES)("reports the %s state as its own text and nothing else", (state, expected) => {
        render(<ConnectionStatus state={state} />);

        expect(screen.getByText(expected)).toBeInTheDocument();

        for (const other of ALL_TEXTS.filter((text) => text !== expected)) {
            expect(screen.queryByText(other)).not.toBeInTheDocument();
        }
    });

    it("swaps the message when the connection state changes", () => {
        const { rerender } = render(<ConnectionStatus state="connected" />);
        expect(screen.getByText("Connected")).toBeInTheDocument();

        rerender(<ConnectionStatus state="reconnecting" />);
        expect(screen.getByText("Reconnecting...")).toBeInTheDocument();
        expect(screen.queryByText("Connected")).not.toBeInTheDocument();

        rerender(<ConnectionStatus state="lost" />);
        expect(screen.getByText("Connection lost")).toBeInTheDocument();
        expect(screen.queryByText("Reconnecting...")).not.toBeInTheDocument();
    });
});
