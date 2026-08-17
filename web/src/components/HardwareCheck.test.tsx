import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import HardwareCheck from "./HardwareCheck";

describe("HardwareCheck", () => {
  it("renders checklist rows without crashing", () => {
    render(<HardwareCheck />);
    expect(screen.getByText("OS & browser")).toBeInTheDocument();
    expect(screen.getByText("Internet")).toBeInTheDocument();
    expect(screen.getByText("Microphone")).toBeInTheDocument();
  });
});
