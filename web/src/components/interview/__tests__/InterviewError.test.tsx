import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import InterviewError from "@/components/interview/InterviewError";

describe("InterviewError", () => {
  it("renders a load failure with a retry button when recoverable", async () => {
    const onRetry = vi.fn();
    render(
      <InterviewError
        error={{ kind: "load_failed", recoverable: true, message: "We couldn't load your interview details." }}
        onRetry={onRetry}
      />
    );

    expect(screen.getByRole("heading", { name: "Couldn't load your interview" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("does NOT show a retry button for a non-recoverable auth failure", () => {
    render(
      <InterviewError
        error={{ kind: "auth_failed", recoverable: false }}
        onRetry={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "This interview link isn't valid" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Try again/i })).not.toBeInTheDocument();
  });

  it("keeps a reload action available for every error kind", () => {
    render(
      <InterviewError
        error={{ kind: "ws_connection_lost", recoverable: true }}
        onRetry={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /Reload page/i })).toBeInTheDocument();
  });

  it("uses a specific message for a missing system prompt", () => {
    render(
      <InterviewError
        error={{ kind: "ws_unrecoverable", code: "no_system_prompt", recoverable: false }}
        onRetry={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Interview isn't ready yet" })).toBeInTheDocument();
  });

  it("shows a recoverable microphone-specific failure", () => {
    render(
      <InterviewError
        error={{ kind: "microphone_unavailable", recoverable: true }}
        onRetry={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Microphone disconnected" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try again/i })).toBeInTheDocument();
  });
});
