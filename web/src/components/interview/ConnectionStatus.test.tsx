import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ConnectionStatus from "./ConnectionStatus";

describe("ConnectionStatus", () => {
  it("renders connected state correctly", () => {
    render(<ConnectionStatus state="connected" />);
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("renders reconnecting state correctly", () => {
    render(<ConnectionStatus state="reconnecting" />);
    expect(screen.getByText("Reconnecting...")).toBeInTheDocument();
  });

  it("renders connection lost state correctly", () => {
    render(<ConnectionStatus state="lost" />);
    expect(screen.getByText("Connection lost")).toBeInTheDocument();
  });
});

