import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import ConnectionStatus from "../ConnectionStatus";

describe("ConnectionStatus", () => {
  test("shows the connected state", () => {
    render(<ConnectionStatus state="connected" />);
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  test("shows the reconnecting state", () => {
    render(<ConnectionStatus state="reconnecting" />);
    expect(screen.getByText(/Reconnecting\.\.\./)).toBeInTheDocument();
  });

  test("shows the connection-lost state", () => {
    render(<ConnectionStatus state="lost" />);
    expect(screen.getByText("Connection lost")).toBeInTheDocument();
  });
});
