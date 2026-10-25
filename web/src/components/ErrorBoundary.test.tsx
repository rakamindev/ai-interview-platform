import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ErrorBoundary from "./ErrorBoundary";

function ProblematicComponent(): JSX.Element {
  throw new Error("Simulated component explosion");
}

describe("ErrorBoundary", () => {
  it("renders children when no runtime error occurs", () => {
    render(
      <ErrorBoundary>
        <div>Safe Child Content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText("Safe Child Content")).toBeInTheDocument();
  });

  it("renders fallback UI when a child component throws", () => {
    // Suppress console.error in test runner for expected error
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ProblematicComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
    expect(screen.getByText("Refresh")).toBeInTheDocument();

    spy.mockRestore();
  });
});
