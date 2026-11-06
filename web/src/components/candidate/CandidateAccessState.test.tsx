import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CandidateAccessState from "./CandidateAccessState";

function renderState(
  error: React.ComponentProps<typeof CandidateAccessState>["error"],
  overrides: Partial<React.ComponentProps<typeof CandidateAccessState>> = {}
) {
  const props = {
    error,
    language: "en" as const,
    onLanguageChange: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  };
  render(<CandidateAccessState {...props} />);
  return props;
}

describe("CandidateAccessState", () => {
  it("explains an expired link and offers no retry", () => {
    renderState("expired");

    expect(screen.getByTestId("access-title")).toHaveTextContent("expired");
    expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument();
  });

  it("offers retry for connection failures", async () => {
    const user = userEvent.setup();
    const props = renderState("network");

    const retry = screen.getByRole("button", { name: /try again/i });
    await user.click(retry);
    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });

  it("speaks Indonesian when requested", () => {
    renderState("revoked", { language: "id" });

    expect(screen.getByTestId("access-title")).toHaveTextContent("dibatalkan");
  });

  it("does not render the completion copy for a not-found link", () => {
    renderState("not_found");

    expect(screen.queryByText(/already completed/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("access-title")).toHaveTextContent("not valid");
  });
});
