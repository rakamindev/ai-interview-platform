import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { renderHook, act } from "@testing-library/react";
import { useCoverageWebSocket } from "./useCoverageWebSocket";
import { MockWebSocket } from "@/test/setup";

const AC = globalThis as unknown as {
  WebSocket: typeof MockWebSocket;
};

function wsInstances() {
  return AC.WebSocket.instances;
}

describe("useCoverageWebSocket", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    AC.WebSocket.instances.length = 0;
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("connects to the session coverage socket and authenticates with a stored token", () => {
    localStorage.setItem("auth_token", "jwt-123");
    const { result } = renderHook(() => useCoverageWebSocket(7));

    expect(wsInstances()).toHaveLength(1);
    expect(wsInstances()[0].url).toContain("/ws/sessions/7/coverage");

    act(() => wsInstances()[0].serverOpen());
    expect(result.current.isConnected).toBe(true);
    expect(wsInstances()[0].send).toHaveBeenCalledWith(
      JSON.stringify({ type: "auth", token: "jwt-123" }),
    );
  });

  it("applies coverage_update frames to coverageMap", () => {
    const { result } = renderHook(() => useCoverageWebSocket(7));

    act(() =>
      wsInstances()[0].serverMessage(
        JSON.stringify({
          type: "coverage_update",
          skills: [{ id: 1, label: "A" }],
          discovered: ["x"],
        }),
      ),
    );

    expect(result.current.coverageMap).toEqual({
      skills: [{ id: 1, label: "A" }],
      discovered: ["x"],
    });
  });

  it("defaults to empty lists when a coverage_update omits them", () => {
    const { result } = renderHook(() => useCoverageWebSocket(7));

    act(() => wsInstances()[0].serverMessage(JSON.stringify({ type: "coverage_update" })));

    expect(result.current.coverageMap).toEqual({ skills: [], discovered: [] });
  });

  it("leaves the end reason null when a session ends without one", () => {
    const { result } = renderHook(() => useCoverageWebSocket(7));

    act(() =>
      wsInstances()[0].serverMessage(JSON.stringify({ type: "session_status", status: "ended" })),
    );

    expect(result.current.sessionEnded).toBe(true);
    expect(result.current.sessionEndReason).toBeNull();
  });

  it("applies transcript_turn frames to liveTurn", () => {
    const { result } = renderHook(() => useCoverageWebSocket(7));
    const turn = { id: 1, speaker: "candidate", text: "Hello" };

    act(() => wsInstances()[0].serverMessage(JSON.stringify({ type: "transcript_turn", turn })));

    expect(result.current.liveTurn).toEqual(turn);
  });

  it("ends the session on session_status ended and stops reconnecting", () => {
    const { result } = renderHook(() => useCoverageWebSocket(7));

    act(() =>
      wsInstances()[0].serverMessage(
        JSON.stringify({ type: "session_status", status: "ended", end_reason: "time_limit" }),
      ),
    );
    expect(result.current.sessionEnded).toBe(true);
    expect(result.current.sessionEndReason).toBe("time_limit");

    act(() => wsInstances()[0].serverClose());
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(wsInstances()).toHaveLength(1); // no reconnect attempts
  });

  it("ignores malformed frames without throwing", () => {
    const { result } = renderHook(() => useCoverageWebSocket(7));

    act(() => wsInstances()[0].serverMessage("not json {"));
    expect(result.current.coverageMap).toBeNull();
  });

  it("reconnects with backoff until delays are exhausted", () => {
    const { result } = renderHook(() => useCoverageWebSocket(7));

    act(() => wsInstances()[0].serverClose());
    expect(result.current.isConnected).toBe(false);

    // attempt 0 → 1000ms, attempt 1 → 2000ms, attempt 2 → 4000ms
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(wsInstances()).toHaveLength(2);
    act(() => wsInstances()[1].serverClose());

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(wsInstances()).toHaveLength(3);
    act(() => wsInstances()[2].serverClose());

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(wsInstances()).toHaveLength(4);
    act(() => wsInstances()[3].serverClose());

    // attempt 3 is past the delay list — no further reconnect
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(wsInstances()).toHaveLength(4);
  });

  it("flips isConnected false on socket errors", () => {
    const { result } = renderHook(() => useCoverageWebSocket(7));
    void result;
    act(() => wsInstances()[0].serverOpen());
    expect(result.current.isConnected).toBe(true);

    act(() => wsInstances()[0].onerror?.({}));
    expect(result.current.isConnected).toBe(false);
  });

  it("closes the socket and clears the reconnect timer on unmount", () => {
    const { unmount } = renderHook(() => useCoverageWebSocket(7));

    act(() => wsInstances()[0].serverClose()); // schedule a reconnect
    act(() => unmount());

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(wsInstances()).toHaveLength(1); // timer was cleared
    expect(wsInstances()[0].close).toHaveBeenCalled();
  });
});
