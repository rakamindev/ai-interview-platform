import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { usePolling } from "./usePolling";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const CEILING = 1000;
const INTERVAL = 100;

function poll(fn: () => void, active = true) {
  return renderHook(
    ({ on }: { on: boolean }) => usePolling(fn, INTERVAL, on, CEILING),
    { initialProps: { on: active } },
  );
}

describe("usePolling", () => {
  it("calls the function on every interval while active", () => {
    const fn = vi.fn();
    poll(fn);

    act(() => void vi.advanceTimersByTime(INTERVAL * 3));

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does nothing while inactive", () => {
    const fn = vi.fn();
    poll(fn, false);

    act(() => void vi.advanceTimersByTime(INTERVAL * 5));

    expect(fn).not.toHaveBeenCalled();
  });

  // Without a ceiling the loop ends only when `active` clears, and `active`
  // follows a status a background job writes. No worker, no write, no end:
  // 159 requests over 7 minutes.
  describe("at the ceiling", () => {
    it("stops polling", () => {
      const fn = vi.fn();
      poll(fn);

      act(() => void vi.advanceTimersByTime(CEILING));
      const atCeiling = fn.mock.calls.length;
      act(() => void vi.advanceTimersByTime(CEILING * 5));

      expect(fn).toHaveBeenCalledTimes(atCeiling);
    });

    it("reports that it gave up, so the page can stop promising", () => {
      const { result } = poll(vi.fn());

      expect(result.current).toBe(false);
      act(() => void vi.advanceTimersByTime(CEILING));

      expect(result.current).toBe(true);
    });
  });

  it("starts over when polling is switched off and on again", () => {
    const fn = vi.fn();
    const { result, rerender } = poll(fn);

    act(() => void vi.advanceTimersByTime(CEILING));
    expect(result.current).toBe(true);

    rerender({ on: false });
    expect(result.current).toBe(false);

    rerender({ on: true });
    act(() => void vi.advanceTimersByTime(INTERVAL * 2));

    expect(fn.mock.calls.length).toBeGreaterThan(0);
    expect(result.current).toBe(false);
  });
});
