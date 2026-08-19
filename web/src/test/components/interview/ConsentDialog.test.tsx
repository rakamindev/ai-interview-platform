import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ConsentDialog from "@/components/interview/ConsentDialog";

function renderDialog(props: Partial<React.ComponentProps<typeof ConsentDialog>> = {}) {
  return render(
    <MemoryRouter>
      <ConsentDialog open onAccept={vi.fn()} onDecline={vi.fn()} {...props} />
    </MemoryRouter>
  );
}

describe("ConsentDialog", () => {
  it("names the third-party AI provider and cross-border processing", () => {
    renderDialog();

    expect(screen.getByText(/Google's Gemini AI/)).toBeInTheDocument();
    expect(screen.getByText(/outside Indonesia/)).toBeInTheDocument();
  });

  it("links to the full privacy policy", () => {
    renderDialog();

    expect(screen.getByText("Privacy Policy").closest("a")).toHaveAttribute("href", "/privacy");
  });

  it("calls onAccept when the candidate consents", () => {
    const onAccept = vi.fn();
    renderDialog({ onAccept });

    fireEvent.click(screen.getByRole("button", { name: "I consent, continue" }));

    expect(onAccept).toHaveBeenCalled();
  });

  it("calls onDecline when the candidate declines", () => {
    const onDecline = vi.fn();
    renderDialog({ onDecline });

    fireEvent.click(screen.getByRole("button", { name: "Decline" }));

    expect(onDecline).toHaveBeenCalled();
  });

  it("disables both actions while submitting", () => {
    renderDialog({ submitting: true });

    expect(screen.getByRole("button", { name: "I consent, continue" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Decline" })).toBeDisabled();
  });

  it("renders nothing when closed", () => {
    renderDialog({ open: false });

    expect(screen.queryByText("Before we start: how your data is used")).not.toBeInTheDocument();
  });
});
