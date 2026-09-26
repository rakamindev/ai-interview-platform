import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ConnectionStatus from "@/components/interview/ConnectionStatus";

describe("ConnectionStatus Component", () => {
  it("renders connected status with appropriate indicator", () => {
    render(<ConnectionStatus state="connected" />);
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("renders reconnecting status with animated spinner", () => {
    render(<ConnectionStatus state="reconnecting" />);
    expect(screen.getByText("Reconnecting...")).toBeInTheDocument();
  });

  it("renders connection lost status with error indicator", () => {
    render(<ConnectionStatus state="lost" />);
    expect(screen.getByText("Connection lost")).toBeInTheDocument();
  });
});
