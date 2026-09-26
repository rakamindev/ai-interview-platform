import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Progress } from "./progress";

describe("Progress", () => {
  it("passes a name and a spoken value to screen readers", () => {
    render(<Progress value={60} aria-label="React coverage" aria-valuetext="Partly covered" />);

    const bar = screen.getByRole("progressbar", { name: "React coverage" });
    expect(bar).toHaveAttribute("aria-valuetext", "Partly covered");
  });

  it("uses the neutral track, not the brand yellow", () => {
    render(<Progress value={0} aria-label="Empty" />);

    expect(screen.getByRole("progressbar", { name: "Empty" })).toHaveClass("bg-muted");
  });
});
