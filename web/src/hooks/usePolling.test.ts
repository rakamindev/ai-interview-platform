import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { renderHook, act } from "@testing-library/react";
import { usePolling } from "./usePolling";

describe("usePolling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls the callback at the given interval while active", () => {
    const fn = vi.fn();
    renderHook(() => usePolling(fn, 5000, true));
    expect(fn).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(fn).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(15000);
    });
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("does not poll while inactive", () => {
    const fn = vi.fn();
    renderHook(() => usePolling(fn, 1000, false));
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(fn).not.toHaveBeenCalled();
  });

  it("stops polling on unmount", () => {
    const fn = vi.fn();
    const { unmount } = renderHook(() => usePolling(fn, 1000, true));
    unmount();
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(fn).not.toHaveBeenCalled();
  });

  it("always invokes the latest callback reference", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ fn }) => usePolling(fn, 1000, true), {
      initialProps: { fn: first },
    });
    rerender({ fn: second });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("restarts the interval when the interval or active flag changes", () => {
    const fn = vi.fn();
    const { rerender } = renderHook(({ ms, active }) => usePolling(fn, ms, active), {
      initialProps: { ms: 5000, active: true },
    });
    rerender({ ms: 1000, active: true });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(fn).toHaveBeenCalledTimes(1);
    rerender({ ms: 1000, active: false });
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
