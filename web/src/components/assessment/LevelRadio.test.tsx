import { describe, it, expect, vi } from "vite-plus/test";
import { render, screen, fireEvent } from "@testing-library/react";
import LevelRadio from "./LevelRadio";

describe("LevelRadio", () => {
  it("renders all five levels and marks the selected one", () => {
    render(<LevelRadio value={3} onChange={vi.fn()} />);
    expect(screen.getByLabelText("L1")).toBeInTheDocument();
    expect(screen.getByLabelText("L5")).toBeInTheDocument();
    expect(screen.getByLabelText("L3")).toHaveAttribute("data-state", "checked");
  });

  it("reports the selected level as a number", () => {
    const onChange = vi.fn();
    render(<LevelRadio value={1} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("L4"));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("disables all radios when disabled", () => {
    render(<LevelRadio value={2} onChange={vi.fn()} disabled />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(5);
    radios.forEach((r) => expect(r).toBeDisabled());
  });
});
