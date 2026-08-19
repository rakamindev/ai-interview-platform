import { describe, it, expect, vi } from "vite-plus/test";
import { render, screen, fireEvent } from "@testing-library/react";
import ErrorRetryState from "./ErrorRetryState";

describe("ErrorRetryState", () => {
  it("renders the message as an alert and a retry button", () => {
    render(<ErrorRetryState message="Something broke" onRetry={vi.fn()} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Something broke");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("fires onRetry when the button is clicked", () => {
    const onRetry = vi.fn();
    render(<ErrorRetryState message="Try again" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
