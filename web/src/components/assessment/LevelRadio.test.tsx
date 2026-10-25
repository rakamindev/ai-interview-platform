import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import LevelRadio from "./LevelRadio";

describe("LevelRadio", () => {
  it("renders all 5 level choices (L1 through L5)", () => {
    const handleChange = vi.fn();
    render(<LevelRadio value={3} onChange={handleChange} />);

    expect(screen.getByText("L1")).toBeInTheDocument();
    expect(screen.getByText("L2")).toBeInTheDocument();
    expect(screen.getByText("L3")).toBeInTheDocument();
    expect(screen.getByText("L4")).toBeInTheDocument();
    expect(screen.getByText("L5")).toBeInTheDocument();
  });

  it("calls onChange when a radio option is clicked", () => {
    const handleChange = vi.fn();
    render(<LevelRadio value={2} onChange={handleChange} />);

    const l4Label = screen.getByText("L4");
    fireEvent.click(l4Label);

    expect(handleChange).toHaveBeenCalledWith(4);
  });
});
