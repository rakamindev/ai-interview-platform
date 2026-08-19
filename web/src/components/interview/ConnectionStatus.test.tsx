import { describe, it, expect } from "vite-plus/test";
import { render, screen } from "@testing-library/react";
import ConnectionStatus from "./ConnectionStatus";

describe("ConnectionStatus", () => {
  it("shows the connected state", () => {
    render(<ConnectionStatus state="connected" />);
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("Connected").className).toContain("text-green-600");
  });

  it("shows the reconnecting state", () => {
    render(<ConnectionStatus state="reconnecting" />);
    expect(screen.getByText("Reconnecting...")).toBeInTheDocument();
    expect(
      screen.getByText("Reconnecting...").closest("div")?.querySelector("svg"),
    ).toBeInTheDocument();
  });

  it("shows the lost state", () => {
    render(<ConnectionStatus state="lost" />);
    expect(screen.getByText("Connection lost")).toBeInTheDocument();
    expect(screen.getByText("Connection lost").className).toContain("text-destructive");
  });
});
