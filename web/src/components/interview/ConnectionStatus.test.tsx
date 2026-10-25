import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ConnectionStatus from "./ConnectionStatus";

describe("ConnectionStatus", () => {
  it("renders Connected state in green", () => {
    render(<ConnectionStatus state="connected" />);
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("renders Reconnecting... state with spinner", () => {
    render(<ConnectionStatus state="reconnecting" />);
    expect(screen.getByText("Reconnecting...")).toBeInTheDocument();
  });

  it("renders Connection lost state", () => {
    render(<ConnectionStatus state="lost" />);
    expect(screen.getByText("Connection lost")).toBeInTheDocument();
  });
});
