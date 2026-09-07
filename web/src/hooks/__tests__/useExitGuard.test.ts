import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useExitGuard } from "@/hooks/useExitGuard";

/** Simulates a browser back press against the guard's sentinel history entry. */
function pressBack() {
  act(() => {
    window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
  });
}

describe("useExitGuard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("asks before letting the candidate navigate away mid-interview", () => {
    const onAttemptExit = vi.fn();
    renderHook(() => useExitGuard({ enabled: true, onAttemptExit }));

    pressBack();

    expect(onAttemptExit).toHaveBeenCalledTimes(1);
  });

  it("keeps catching repeated back presses instead of letting the second one through", () => {
    const onAttemptExit = vi.fn();
    renderHook(() => useExitGuard({ enabled: true, onAttemptExit }));

    pressBack();
    pressBack();

    expect(onAttemptExit).toHaveBeenCalledTimes(2);
  });

  it("does not interfere once the interview is no longer in progress", () => {
    const onAttemptExit = vi.fn();
    renderHook(() => useExitGuard({ enabled: false, onAttemptExit }));

    pressBack();

    expect(onAttemptExit).not.toHaveBeenCalled();
  });

  it("stops guarding after the interview screen unmounts", () => {
    const onAttemptExit = vi.fn();
    const { unmount } = renderHook(() => useExitGuard({ enabled: true, onAttemptExit }));

    unmount();
    pressBack();

    expect(onAttemptExit).not.toHaveBeenCalled();
  });

  it("blocks a tab close / refresh with the browser's own prompt", () => {
    renderHook(() => useExitGuard({ enabled: true, onAttemptExit: vi.fn() }));

    const event = new Event("beforeunload", { cancelable: true });
    act(() => {
      window.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
  });
});
