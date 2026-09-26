import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import LevelRadio from "./LevelRadio";

describe("LevelRadio", () => {
  it("changes only its own skill when a level label is clicked", async () => {
    const firstSkill = vi.fn();
    const secondSkill = vi.fn();
    render(
      <>
        <LevelRadio value={3} onChange={firstSkill} />
        <LevelRadio value={3} onChange={secondSkill} />
      </>
    );

    await userEvent.click(screen.getAllByText("L4")[1]);

    expect(secondSkill).toHaveBeenCalledWith(4);
    expect(firstSkill).not.toHaveBeenCalled();
  });
});
