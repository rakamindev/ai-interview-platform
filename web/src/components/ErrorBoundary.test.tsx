import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ErrorBoundary from "./ErrorBoundary";

describe("ErrorBoundary", () => {
  it("renders ErrorBoundary fallback when a child component throws", () => {
    const CrashingComponent = () => {
      throw new Error("Simulated render crash");
    };

    // Suppress console.error during expected error boundary test
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <CrashingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    expect(screen.getByText(/Simulated render crash/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reload Page/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Go to Dashboard/i })).toBeInTheDocument();

    spy.mockRestore();
  });
});
