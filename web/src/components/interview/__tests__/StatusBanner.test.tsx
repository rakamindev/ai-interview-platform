import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StatusBanner from "@/components/interview/StatusBanner";

describe("StatusBanner", () => {
  it("carries its tone so the four states are distinguishable, not just differently worded", () => {
    const { rerender } = render(<StatusBanner tone="warning">Reconnecting</StatusBanner>);
    expect(screen.getByRole("status")).toHaveAttribute("data-tone", "warning");

    rerender(<StatusBanner tone="danger">Connection lost</StatusBanner>);
    expect(screen.getByRole("status")).toHaveAttribute("data-tone", "danger");
  });

  it("is announced to screen readers without stealing focus", () => {
    render(<StatusBanner tone="info">Reconnected</StatusBanner>);

    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });

  it("shows a dismiss control only when the banner can be dismissed", async () => {
    const onDismiss = vi.fn();
    const { rerender } = render(<StatusBanner tone="info">Reconnected</StatusBanner>);
    expect(screen.queryByRole("button", { name: /dismiss/i })).not.toBeInTheDocument();

    rerender(<StatusBanner tone="info" onDismiss={onDismiss}>Reconnected</StatusBanner>);
    await userEvent.click(screen.getByRole("button", { name: /dismiss/i }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
