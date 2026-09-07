import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ExitConfirmDialog from "@/components/interview/ExitConfirmDialog";

describe("ExitConfirmDialog", () => {
  it("offers both choices instead of exiting silently", async () => {
    render(<ExitConfirmDialog open source="navigation" onContinue={vi.fn()} onEnd={vi.fn()} />);

    expect(screen.getByText(/leave the interview\?/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue interview/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /end interview/i })).toBeInTheDocument();
  });

  it("keeps the candidate in the interview when they choose to continue", async () => {
    const onContinue = vi.fn();
    const onEnd = vi.fn();
    render(<ExitConfirmDialog open source="navigation" onContinue={onContinue} onEnd={onEnd} />);

    await userEvent.click(screen.getByRole("button", { name: /continue interview/i }));

    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onEnd).not.toHaveBeenCalled();
  });

  it("ends the interview only on an explicit choice", async () => {
    const onContinue = vi.fn();
    const onEnd = vi.fn();
    render(<ExitConfirmDialog open source="manual" onContinue={onContinue} onEnd={onEnd} />);

    await userEvent.click(screen.getByRole("button", { name: /end interview/i }));

    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onContinue).not.toHaveBeenCalled();
  });

  it("uses different copy for a back-button exit than for the End Interview button", () => {
    const { rerender } = render(
      <ExitConfirmDialog open source="navigation" onContinue={vi.fn()} onEnd={vi.fn()} />
    );
    expect(screen.getByTestId("exit-confirm-dialog")).toHaveAttribute("data-source", "navigation");

    rerender(<ExitConfirmDialog open source="manual" onContinue={vi.fn()} onEnd={vi.fn()} />);
    expect(screen.getByText(/end the interview\?/i)).toBeInTheDocument();
  });

  it("does not end the interview on a stray Escape key press", async () => {
    const onEnd = vi.fn();
    const onContinue = vi.fn();
    render(<ExitConfirmDialog open source="navigation" onContinue={onContinue} onEnd={onEnd} />);

    await userEvent.keyboard("{Escape}");

    expect(onEnd).not.toHaveBeenCalled();
    expect(screen.getByTestId("exit-confirm-dialog")).toBeInTheDocument();
  });
});
