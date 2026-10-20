import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { usePolling } from "./usePolling";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("usePolling", () => {
  it("polls only while active and uses the latest callback", async () => {
    vi.useFakeTimers();
    const first = vi.fn();
    const latest = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ fn, active }) => usePolling(fn, 1000, active),
      { initialProps: { fn: first, active: true } }
    );

    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(first).toHaveBeenCalledTimes(1);

    rerender({ fn: latest, active: true });
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(first).toHaveBeenCalledTimes(1);
    expect(latest).toHaveBeenCalledTimes(1);

    unmount();
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(latest).toHaveBeenCalledTimes(1);
  });

  it("does not schedule a timer while inactive", async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    renderHook(() => usePolling(fn, 1000, false));

    await act(async () => { vi.advanceTimersByTime(3000); });

    expect(fn).not.toHaveBeenCalled();
  });
});
