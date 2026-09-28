import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LevelRadio from "./LevelRadio";
describe("Skill level fields", () => {
  it("connects labels to the correct group when several skills are present", () => {
    const first = vi.fn(),
      second = vi.fn();
    const { container } = render(
      <>
        <LevelRadio value={1} onChange={first} />
        <LevelRadio value={1} onChange={second} />
      </>,
    );
    const ids = screen.getAllByRole("radio").map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    fireEvent.click(container.querySelectorAll("label")[7]);
    expect(second).toHaveBeenCalledWith(3);
    expect(first).not.toHaveBeenCalled();
  });
});
