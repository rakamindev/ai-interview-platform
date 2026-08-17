import { describe, it, expect } from "vite-plus/test";
import { render, screen } from "@testing-library/react";
import StatusIndicator from "./StatusIndicator";
import { ProctoringState } from "@/utils/hardwareUtils";

describe("StatusIndicator", () => {
  it("shows the checking state while loading", () => {
    render(<StatusIndicator state={ProctoringState.LOADING} />);
    expect(screen.getByText("Checking...")).toBeInTheDocument();
    expect(
      screen.getByText("Checking...").closest("div")?.querySelector("svg"),
    ).toBeInTheDocument();
  });

  it("shows the passed state", () => {
    render(<StatusIndicator state={ProctoringState.PASSED} />);
    expect(screen.getByText("Passed")).toBeInTheDocument();
    expect(screen.getByText("Passed").className).toContain("text-green-600");
  });

  it("shows the failed state on error", () => {
    render(<StatusIndicator state={ProctoringState.ERROR} />);
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("Failed").className).toContain("text-destructive");
  });

  it("shows the waiting state by default", () => {
    render(<StatusIndicator state={ProctoringState.WAITING} />);
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    expect(screen.getByText("Waiting").className).toContain("text-muted-foreground");
  });
});
