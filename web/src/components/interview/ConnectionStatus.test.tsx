import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ConnectionStatus from "./ConnectionStatus";

describe("ConnectionStatus", () => {
  it.each([
    ["connected", "Connected"],
    ["reconnecting", "Reconnecting..."],
    ["lost", "Connection lost"],
  ] as const)("shows the label for %s", (state, label) => {
    render(<ConnectionStatus state={state} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
