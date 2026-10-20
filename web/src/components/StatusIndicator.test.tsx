import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import StatusIndicator from "@/components/StatusIndicator";
import { ProctoringState } from "@/utils/hardwareUtils";

const LABELS = ["Checking...", "Passed", "Failed", "Waiting"];

const CASES: Array<[ProctoringState, string]> = [
    [ProctoringState.LOADING, "Checking..."],
    [ProctoringState.PASSED, "Passed"],
    [ProctoringState.ERROR, "Failed"],
    [ProctoringState.WAITING, "Waiting"],
];

describe("StatusIndicator", () => {
    it.each(CASES)("shows exactly the %s label on its own", (state, label) => {
        render(<StatusIndicator state={state} />);

        expect(screen.getByText(label)).toBeInTheDocument();
        expect(LABELS.filter((candidate) => screen.queryByText(candidate))).toEqual([label]);
    });

    it("falls back to Waiting for a state it does not know", () => {
        render(<StatusIndicator state={"unexpected" as ProctoringState} />);

        expect(screen.getByText("Waiting")).toBeInTheDocument();
        expect(LABELS.filter((candidate) => screen.queryByText(candidate))).toEqual(["Waiting"]);
    });
});
