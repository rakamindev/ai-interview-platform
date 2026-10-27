import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWakeLock } from "../hooks/useWakeLock";

describe("useWakeLock hook", () => {
  let releaseMock: ReturnType<typeof vi.fn>;
  let requestMock: ReturnType<typeof vi.fn>;
  let mockSentinel: any;

  beforeEach(() => {
    releaseMock = vi.fn().mockResolvedValue(undefined);
    mockSentinel = {
      released: false,
      release: releaseMock,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    requestMock = vi.fn().mockResolvedValue(mockSentinel);

    Object.defineProperty(navigator, "wakeLock", {
      value: { request: requestMock },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("requests screen wake lock when enabled is true", async () => {
    const onRequestMock = vi.fn();
    const { result } = renderHook(() =>
      useWakeLock({ enabled: true, onRequest: onRequestMock })
    );

    expect(result.current.isSupported).toBe(true);

    await act(async () => {
      await Promise.resolve();
    });

    expect(requestMock).toHaveBeenCalledWith("screen");
    expect(result.current.isActive).toBe(true);
    expect(onRequestMock).toHaveBeenCalledTimes(1);
  });

  it("releases wake lock on unmount or when enabled becomes false", async () => {
    const { result, rerender, unmount } = renderHook(
      ({ enabled }) => useWakeLock({ enabled }),
      { initialProps: { enabled: true } }
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isActive).toBe(true);

    // Disable wake lock
    await act(async () => {
      rerender({ enabled: false });
    });

    expect(releaseMock).toHaveBeenCalledTimes(1);
    expect(result.current.isActive).toBe(false);

    // Unmount
    unmount();
  });

  it("re-acquires wake lock on document visibilitychange to visible", async () => {
    renderHook(() => useWakeLock({ enabled: true }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(requestMock).toHaveBeenCalledTimes(1);

    // Simulate switching away (sentinel released by browser)
    mockSentinel.released = true;

    // Simulate user returning to the tab
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
    });

    expect(requestMock).toHaveBeenCalledTimes(2);
  });

  it("handles unsupported navigator.wakeLock gracefully", async () => {
    Object.defineProperty(navigator, "wakeLock", {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const onErrorMock = vi.fn();
    const { result } = renderHook(() =>
      useWakeLock({ enabled: true, onError: onErrorMock })
    );

    expect(result.current.isSupported).toBe(false);
    expect(result.current.isActive).toBe(false);
    expect(onErrorMock).not.toHaveBeenCalled();
  });
});
