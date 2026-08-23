import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ConsentGate from "@/components/interview/ConsentGate";

describe("ConsentGate — UU PDP consent gate", () => {
  it("starts with Continue disabled (no consent without explicit action)", () => {
    render(<ConsentGate onAgree={vi.fn()} />);

    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("discloses AI processing and third-party processing before consent", () => {
    render(<ConsentGate onAgree={vi.fn()} />);

    expect(screen.getByText(/analyzed by AI/i)).toBeInTheDocument();
    expect(screen.getByText(/Google's AI service/i)).toBeInTheDocument();
    expect(screen.getByText(/request deletion/i)).toBeInTheDocument();
  });

  it("enables Continue after the checkbox is ticked", async () => {
    const user = userEvent.setup();
    render(<ConsentGate onAgree={vi.fn()} />);

    await user.click(screen.getByRole("checkbox"));

    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("calls onAgree when the candidate confirms", async () => {
    const onAgree = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ConsentGate onAgree={onAgree} />);

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(onAgree).toHaveBeenCalledTimes(1);
  });

  it("does not call onAgree when Continue is clicked without ticking", async () => {
    const onAgree = vi.fn();
    const user = userEvent.setup();
    render(<ConsentGate onAgree={onAgree} />);

    // Button is disabled — click attempt must be a no-op
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(onAgree).not.toHaveBeenCalled();
  });
});
