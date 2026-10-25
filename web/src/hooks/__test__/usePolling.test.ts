import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { usePolling } from "../usePolling";

describe("usePolling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("polls at the configured interval while active", () => {
    const fn = vi.fn();
    renderHook(() => usePolling(fn, 5000, true));

    act(() => {
      vi.advanceTimersByTime(5000 * 3);
    });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  test("does not poll while inactive", () => {
    const fn = vi.fn();
    renderHook(() => usePolling(fn, 5000, false));

    act(() => {
      vi.advanceTimersByTime(5000 * 3);
    });
    expect(fn).not.toHaveBeenCalled();
  });

  test("stops polling when the active flag turns off", () => {
    const fn = vi.fn();
    const { rerender } = renderHook(({ active }: { active: boolean } = { active: true }) =>
      usePolling(fn, 5000, active),
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(fn).toHaveBeenCalledTimes(1);

    rerender({ active: false });
    act(() => {
      vi.advanceTimersByTime(5000 * 3);
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
