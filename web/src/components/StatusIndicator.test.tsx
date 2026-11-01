import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import StatusIndicator from "@/components/StatusIndicator";
import { ProctoringState } from "@/utils/hardwareUtils";

describe("StatusIndicator", () => {
  it.each([
    [ProctoringState.WAITING, "Waiting"],
    [ProctoringState.LOADING, "Checking..."],
    [ProctoringState.PASSED, "Passed"],
    [ProctoringState.ERROR, "Failed"],
  ])("renders the %s state", (state, label) => {
    render(<StatusIndicator state={state} />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
