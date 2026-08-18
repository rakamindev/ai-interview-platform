import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import LevelRadio from "./LevelRadio";

describe("LevelRadio", () => {
  it("renders all level options", () => {
    render(
      <LevelRadio
        value={3}
        onChange={vi.fn()}
      />
    );

    expect(
      screen.getByRole("radio", { name: "L1" })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("radio", { name: "L2" })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("radio", { name: "L3" })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("radio", { name: "L4" })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("radio", { name: "L5" })
    ).toBeInTheDocument();
  });

  it("selects the current value", () => {
    render(
      <LevelRadio
        value={3}
        onChange={vi.fn()}
      />
    );

    expect(
      screen.getByRole("radio", { name: "L3" })
    ).toBeChecked();

    expect(
      screen.getByRole("radio", { name: "L1" })
    ).not.toBeChecked();

    expect(
      screen.getByRole("radio", { name: "L5" })
    ).not.toBeChecked();
  });

  it("calls onChange when a different level is selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <LevelRadio
        value={3}
        onChange={onChange}
      />
    );

    await user.click(
      screen.getByRole("radio", { name: "L4" })
    );

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("supports selecting every level", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <LevelRadio
        value={1}
        onChange={onChange}
      />
    );

    for (let level = 2; level <= 5; level++) {
      await user.click(
        screen.getByRole("radio", { name: `L${level}` })
      );
    }

    expect(onChange).toHaveBeenNthCalledWith(1, 2);
    expect(onChange).toHaveBeenNthCalledWith(2, 3);
    expect(onChange).toHaveBeenNthCalledWith(3, 4);
    expect(onChange).toHaveBeenNthCalledWith(4, 5);
  });

  it("disables all options when disabled", () => {
    render(
      <LevelRadio
        value={3}
        onChange={vi.fn()}
        disabled
      />
    );

    for (let level = 1; level <= 5; level++) {
      expect(
        screen.getByRole("radio", { name: `L${level}` })
      ).toBeDisabled();
    }
  });

  it("does not call onChange when disabled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <LevelRadio
        value={3}
        onChange={onChange}
        disabled
      />
    );

    await user.click(
      screen.getByRole("radio", { name: "L4" })
    );

    expect(onChange).not.toHaveBeenCalled();
  });

  it("applies custom className", () => {
    const { container } = render(
      <LevelRadio
        value={3}
        onChange={vi.fn()}
        className="custom-level-radio"
      />
    );

    expect(
      container.querySelector(".custom-level-radio")
    ).toBeInTheDocument();
  });
});