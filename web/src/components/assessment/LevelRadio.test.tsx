import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import LevelRadio from "@/components/assessment/LevelRadio";

describe("LevelRadio", () => {
  it("changes only its own group when a level label is clicked", async () => {
    const first = vi.fn();
    const second = vi.fn();
    const user = userEvent.setup();

    render(
      <>
        <LevelRadio value={3} onChange={first} />
        <LevelRadio value={3} onChange={second} />
      </>,
    );

    await user.click(screen.getAllByText("L5")[1]);

    expect(second).toHaveBeenCalledWith(5);
    expect(first).not.toHaveBeenCalled();
  });

  it("shows no level selected when the value is unknown", () => {
    render(<LevelRadio value={null} onChange={vi.fn()} />);

    expect(
      screen.getAllByRole("radio").every((r) => r.getAttribute("aria-checked") === "false"),
    ).toBe(true);
  });
});
