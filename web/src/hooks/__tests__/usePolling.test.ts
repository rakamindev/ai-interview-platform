import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePolling } from "@/hooks/usePolling";

describe("usePolling", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("keeps polling indefinitely when no limit is given (original behaviour)", async () => {
    const fn = vi.fn();
    renderHook(() => usePolling(fn, 1000, true));

    await act(async () => { await vi.advanceTimersByTimeAsync(50_000); });

    expect(fn).toHaveBeenCalledTimes(50);
  });

  it("stops after maxAttempts and reports exhaustion exactly once", async () => {
    const fn = vi.fn();
    const onExhausted = vi.fn();
    renderHook(() => usePolling(fn, 1000, true, { maxAttempts: 3, onExhausted }));

    await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });

    expect(fn).toHaveBeenCalledTimes(3);
    expect(onExhausted).toHaveBeenCalledTimes(1);
  });

  it("gives a fresh budget when it is re-activated", async () => {
    const fn = vi.fn();
    const { rerender } = renderHook(
      ({ active }) => usePolling(fn, 1000, active, { maxAttempts: 2 }),
      { initialProps: { active: true } }
    );
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(fn).toHaveBeenCalledTimes(2);

    rerender({ active: false });
    rerender({ active: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });

    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("counts a rejected tick against the budget and does not throw", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("network down"));
    const onExhausted = vi.fn();
    renderHook(() => usePolling(fn, 1000, true, { maxAttempts: 2, onExhausted }));

    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });

    expect(fn).toHaveBeenCalledTimes(2);
    expect(onExhausted).toHaveBeenCalledTimes(1);
  });

  it("does nothing while inactive", async () => {
    const fn = vi.fn();
    renderHook(() => usePolling(fn, 1000, false, { maxAttempts: 2 }));

    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });

    expect(fn).not.toHaveBeenCalled();
  });
});
