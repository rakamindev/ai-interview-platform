import { describe, it, expect, vi, afterEach } from "vite-plus/test";
import { render, screen, fireEvent } from "@testing-library/react";
import ErrorBoundary from "./ErrorBoundary";

function Boom(): never {
  throw new Error("kaboom");
}

const originalLocation = window.location;

afterEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: originalLocation,
  });
});

describe("ErrorBoundary", () => {
  it("renders children when there is no error", () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("All good")).toBeInTheDocument();
  });

  it("renders the fallback and reloads on Refresh when a child throws", () => {
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: { reload },
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(reload).toHaveBeenCalledTimes(1);

    spy.mockRestore();
  });
});
