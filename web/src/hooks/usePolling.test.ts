import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePolling } from "./usePolling";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("usePolling", () => {
  it("calls the function on every interval while active", () => {
    const fn = vi.fn();
    renderHook(() => usePolling(fn, 5000, true));

    vi.advanceTimersByTime(4999);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(10_001);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does nothing while inactive, and stops when it becomes inactive", () => {
    const fn = vi.fn();
    const { rerender } = renderHook(({ active }) => usePolling(fn, 1000, active), { initialProps: { active: false } });

    vi.advanceTimersByTime(3000);
    expect(fn).not.toHaveBeenCalled();

    rerender({ active: true });
    vi.advanceTimersByTime(2000);
    rerender({ active: false });
    vi.advanceTimersByTime(5000);

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("always calls the latest function without restarting the timer", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ fn }) => usePolling(fn, 1000, true), { initialProps: { fn: first } });

    vi.advanceTimersByTime(600);
    rerender({ fn: second });
    vi.advanceTimersByTime(400);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("stops when the component unmounts", () => {
    const fn = vi.fn();
    const { unmount } = renderHook(() => usePolling(fn, 1000, true));

    unmount();
    vi.advanceTimersByTime(5000);

    expect(fn).not.toHaveBeenCalled();
  });
});
