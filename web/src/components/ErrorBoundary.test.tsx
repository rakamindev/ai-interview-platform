import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ErrorBoundary from "./ErrorBoundary";

function Broken(): JSX.Element {
  throw new Error("render failed");
}

describe("ErrorBoundary", () => {
  it("renders its children when nothing goes wrong", () => {
    render(<ErrorBoundary><p>Portfolio</p></ErrorBoundary>);

    expect(screen.getByText("Portfolio")).toBeInTheDocument();
  });

  it("replaces a crashed tree with a recoverable message", () => {
    // React logs the caught error; keep the test output readable.
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(<ErrorBoundary><Broken /></ErrorBoundary>);

    expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
  });
});
