import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import StatusIndicator from "./StatusIndicator";
import { ProctoringState } from "@/utils/hardwareUtils";

describe("StatusIndicator", () => {
  it("renders Loading state", () => {
    render(<StatusIndicator state={ProctoringState.LOADING} />);
    expect(screen.getByText("Checking...")).toBeInTheDocument();
  });

  it("renders Passed state", () => {
    render(<StatusIndicator state={ProctoringState.PASSED} />);
    expect(screen.getByText("Passed")).toBeInTheDocument();
  });

  it("renders Failed state on Error", () => {
    render(<StatusIndicator state={ProctoringState.ERROR} />);
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("renders Waiting state for idle or other", () => {
    render(<StatusIndicator state={ProctoringState.WAITING} />);
    expect(screen.getByText("Waiting")).toBeInTheDocument();
  });
});
