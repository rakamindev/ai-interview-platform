import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePolling } from "./usePolling";

describe("usePolling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("calls the function at the configured interval while active", () => {
    const callback = vi.fn();

    renderHook(() => usePolling(callback, 5000, true));

    act(() => {
      vi.advanceTimersByTime(15000);
    });

    expect(callback).toHaveBeenCalledTimes(3);
  });

  it("does not poll while inactive", () => {
    const callback = vi.fn();

    renderHook(() => usePolling(callback, 5000, false));

    act(() => {
      vi.advanceTimersByTime(15000);
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it("stops polling when the hook becomes inactive", () => {
    const callback = vi.fn();
    const { rerender } = renderHook(
      ({ active }) => usePolling(callback, 5000, active),
      { initialProps: { active: true } }
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(callback).toHaveBeenCalledTimes(1);

    rerender({ active: false });

    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("cleans up the timer when the hook unmounts", () => {
    const callback = vi.fn();
    const { unmount } = renderHook(() => usePolling(callback, 5000, true));

    unmount();

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(callback).not.toHaveBeenCalled();
  });
});
