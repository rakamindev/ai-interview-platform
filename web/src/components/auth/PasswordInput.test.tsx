import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import PasswordInput from "@/components/auth/PasswordInput";

describe("PasswordInput", () => {
  it("toggles visibility while preserving the value and never submits", () => {
    const submit = vi.fn();
    render(
      <form onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <PasswordInput aria-label="Password" defaultValue="secret" />
        <button type="submit">Submit</button>
      </form>,
    );

    const input = screen.getByLabelText("Password");
    const toggle = screen.getByRole("button", { name: "Show password" });
    expect(input).toHaveAttribute("type", "password");

    fireEvent.click(toggle);

    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveValue("secret");
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(input).toHaveAttribute("type", "password");
    expect(submit).not.toHaveBeenCalled();
  });
});
