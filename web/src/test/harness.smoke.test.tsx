import { describe, it, expect } from "vite-plus/test";
import { render, screen } from "@testing-library/react";
import StatusIndicator from "@/components/StatusIndicator";
import { ProctoringState } from "@/utils/hardwareUtils";

describe("StatusIndicator (harness smoke test)", () => {
  it("renders the waiting state by default", () => {
    render(<StatusIndicator state={ProctoringState.WAITING} />);
    expect(screen.getByText("Waiting")).toBeInTheDocument();
  });

  it("renders the loading state", () => {
    render(<StatusIndicator state={ProctoringState.LOADING} />);
    expect(screen.getByText("Checking...")).toBeInTheDocument();
  });

  it("renders the passed state", () => {
    render(<StatusIndicator state={ProctoringState.PASSED} />);
    expect(screen.getByText("Passed")).toBeInTheDocument();
  });

  it("renders the error state", () => {
    render(<StatusIndicator state={ProctoringState.ERROR} />);
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });
});
