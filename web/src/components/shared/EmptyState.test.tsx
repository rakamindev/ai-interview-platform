import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorState } from "./EmptyState";

describe("ErrorState", () => {
  it("surfaces the failure copy and retry action", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();

    render(
      <ErrorState
        title="Portfolio generation failed"
        description="Model timeout"
        onRetry={onRetry}
      />
    );

    expect(screen.getByText("Portfolio generation failed")).toBeInTheDocument();
    expect(screen.getByText("Model timeout")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
