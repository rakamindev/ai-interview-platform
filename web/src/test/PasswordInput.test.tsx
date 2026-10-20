import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PasswordInput } from "@/components/PasswordInput";

describe("PasswordInput show/hide", () => {
  it("toggles type on click and back on second click", () => {
    render(<PasswordInput aria-label="pw" />);
    const input = screen.getByLabelText("pw") as HTMLInputElement;
    const btn = screen.getByTestId("toggle-password");

    expect(input.type).toBe("password");
    fireEvent.click(btn);
    expect(input.type).toBe("text");
    fireEvent.click(btn);
    expect(input.type).toBe("password");
  });

  it("does not submit the form", () => {
    const onSubmit = vi.fn(e => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <PasswordInput aria-label="pw" />
      </form>,
    );
    fireEvent.click(screen.getByTestId("toggle-password"));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
