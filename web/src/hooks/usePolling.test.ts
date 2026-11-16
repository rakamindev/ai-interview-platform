import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePolling } from "./usePolling";

describe("usePolling", () => {
  it("calls fn on every interval while active", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    renderHook(() => usePolling(fn, 1000, true));
    vi.advanceTimersByTime(3000);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does nothing when inactive", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    renderHook(() => usePolling(fn, 1000, false));
    vi.advanceTimersByTime(5000);
    expect(fn).not.toHaveBeenCalled();
  });

  it("stops when active flips to false and on unmount", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const { rerender, unmount } = renderHook(({ active }) => usePolling(fn, 1000, active), {
      initialProps: { active: true },
    });
    vi.advanceTimersByTime(1000);
    rerender({ active: false });
    vi.advanceTimersByTime(3000);
    expect(fn).toHaveBeenCalledTimes(1);

    rerender({ active: true });
    unmount();
    vi.advanceTimersByTime(3000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("always calls the latest fn without resetting the timer", () => {
    vi.useFakeTimers();
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ fn }) => usePolling(fn, 1000, true), {
      initialProps: { fn: first },
    });
    vi.advanceTimersByTime(500);
    rerender({ fn: second });
    vi.advanceTimersByTime(500);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
