import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import StatusIndicator from "@/components/StatusIndicator";
import { ProctoringState } from "@/utils/hardwareUtils";

describe("StatusIndicator", () => {
    it("shows the checking state while hardware is being verified", () => {
        render(<StatusIndicator state={ProctoringState.LOADING} />);

        expect(screen.getByText("Checking...")).toBeInTheDocument();
        expect(screen.queryByText("Passed")).not.toBeInTheDocument();
        expect(screen.queryByText("Failed")).not.toBeInTheDocument();
    });

    it("shows the passed state", () => {
        render(<StatusIndicator state={ProctoringState.PASSED} />);

        expect(screen.getByText("Passed")).toBeInTheDocument();
        expect(screen.queryByText("Failed")).not.toBeInTheDocument();
    });

    it("shows the failed state", () => {
        render(<StatusIndicator state={ProctoringState.ERROR} />);

        expect(screen.getByText("Failed")).toBeInTheDocument();
        expect(screen.queryByText("Passed")).not.toBeInTheDocument();
    });

    it("shows the waiting state before checks start", () => {
        render(<StatusIndicator state={ProctoringState.WAITING} />);

        expect(screen.getByText("Waiting")).toBeInTheDocument();
    });

    it("falls back to waiting for a state it does not recognise", () => {
        render(<StatusIndicator state={"nope" as ProctoringState} />);

        expect(screen.getByText("Waiting")).toBeInTheDocument();
    });
});
