import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useBackendStatus } from "./useBackendStatus";

vi.mock("@/services/health", () => ({
  healthApi: { check: vi.fn() },
}));

import { healthApi } from "@/services/health";

const check = healthApi.check as unknown as ReturnType<typeof vi.fn>;

describe("useBackendStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    check.mockReset();
    check.mockResolvedValue({ data: { status: "ok" } });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("starts as checking then becomes online when health succeeds", async () => {
    const { result } = renderHook(() => useBackendStatus());

    expect(result.current.status).toBe("checking");

    await act(async () => {
      await Promise.resolve();
    });

    expect(check).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("online");
  });

  it("becomes offline when the health request fails", async () => {
    check.mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useBackendStatus());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.status).toBe("offline");
  });

  it("rechecks manually", async () => {
    const { result } = renderHook(() => useBackendStatus());

    await act(async () => {
      await Promise.resolve();
    });
    expect(check).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.recheck();
      await Promise.resolve();
    });

    expect(check).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("online");
  });

  it("refreshes silently every interval", async () => {
    const { result } = renderHook(() => useBackendStatus());

    await act(async () => {
      await Promise.resolve();
    });
    expect(check).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await Promise.resolve();
    });

    expect(check).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("online");
  });

  it("clears the interval on unmount", () => {
    const { unmount } = renderHook(() => useBackendStatus());
    expect(check).toHaveBeenCalledTimes(1);

    unmount();

    vi.advanceTimersByTime(90_000);

    expect(check).toHaveBeenCalledTimes(1);
  });
});