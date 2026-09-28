import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { FilterSelect } from "./filter-select";

function Fixture({ disabled = false }) {
  const [value, setValue] = useState("all");
  return <FilterSelect label="Candidate status" value={value} onValueChange={setValue} disabled={disabled}
    options={[{ value: "all", label: "All candidates" }, { value: "live", label: "Live" }, { value: "unavailable", label: "Unavailable", disabled: true }]} />;
}

describe("Filter select interactions", () => {
  it("opens from the keyboard, marks selection, and restores focus on Escape", async () => {
    render(<Fixture />);
    const trigger = screen.getByRole("combobox", { name: "Candidate status" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const selected = await screen.findByRole("option", { name: "All candidates" });
    expect(selected).toHaveAttribute("data-state", "checked");
    expect(screen.getByRole("option", { name: "Unavailable" })).toHaveAttribute("aria-disabled", "true");
    fireEvent.keyDown(selected, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(trigger).toHaveTextContent("All candidates");
  });

  it("commits a selection and closes the popup", async () => {
    render(<Fixture />);
    const trigger = screen.getByRole("combobox");
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: "Live" }));
    expect(trigger).toHaveTextContent("Live");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("does not open a disabled filter", () => {
    render(<Fixture disabled />);
    const trigger = screen.getByRole("combobox");
    expect(trigger).toBeDisabled();
    fireEvent.click(trigger);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
