import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import LevelRadio from "../LevelRadio";

describe("LevelRadio component", () => {
  it("renders all level options L1 to L5", () => {
    const handleChange = vi.fn();
    render(<LevelRadio value={3} onChange={handleChange} />);

    // Check all labels exist
    expect(screen.getAllByText("L1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("L2").length).toBeGreaterThan(0);
    expect(screen.getAllByText("L3").length).toBeGreaterThan(0);
    expect(screen.getAllByText("L4").length).toBeGreaterThan(0);
    expect(screen.getAllByText("L5").length).toBeGreaterThan(0);
  });

  it("calls onChange with numeric level when mobile segmented pill is clicked", () => {
    const handleChange = vi.fn();
    render(<LevelRadio value={2} onChange={handleChange} />);

    // Mobile pills have role="radio" and text L4
    const radioPills = screen.getAllByRole("radio", { name: "L4" });
    expect(radioPills.length).toBeGreaterThan(0);

    fireEvent.click(radioPills[0]);
    expect(handleChange).toHaveBeenCalledWith(4);
  });

  it("disables interaction when disabled prop is true", () => {
    const handleChange = vi.fn();
    render(<LevelRadio value={3} onChange={handleChange} disabled={true} />);

    const radioPills = screen.getAllByRole("radio", { name: "L5" });
    expect(radioPills[0]).toBeDisabled();

    fireEvent.click(radioPills[0]);
    expect(handleChange).not.toHaveBeenCalled();
  });
});
