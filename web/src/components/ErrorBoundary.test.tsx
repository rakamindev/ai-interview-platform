import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ErrorBoundary from "@/components/ErrorBoundary";

function Crash(): never {
  throw new Error("render failed");
}

describe("ErrorBoundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps content outside the boundary when a page crashes", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <>
        <nav>Assessments</nav>
        <ErrorBoundary fullScreen={false}>
          <Crash />
        </ErrorBoundary>
      </>,
    );

    expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
    expect(screen.getByText("Assessments")).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith(
      "[ErrorBoundary] Page crashed:",
      expect.objectContaining({ message: "render failed" }),
      expect.any(String),
    );
  });
});
