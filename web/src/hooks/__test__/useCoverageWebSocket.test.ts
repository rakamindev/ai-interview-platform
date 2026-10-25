import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useCoverageWebSocket } from "../useCoverageWebSocket";

vi.mock("@/stores/authAtom", () => ({
  getStoredToken: () => "assessor-token",
}));

const RECONNECT_DELAYS = [1000, 2000, 4000];

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static readonly OPEN = 1;

  url: string;
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  sent: unknown[] = [];

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  send(data: unknown) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
    this.onclose?.();
  }

  open() {
    this.readyState = 1;
    this.onopen?.();
  }

  message(data: unknown) {
    this.onmessage?.({ data });
  }
}

describe("useCoverageWebSocket", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", FakeWebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function connect() {
    return FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
  }

  test("auto-connects to the coverage channel and authenticates on open", () => {
    const { result } = renderHook(() => useCoverageWebSocket(42));

    expect(FakeWebSocket.instances).toHaveLength(1);
    const ws = connect();
    expect(ws.url).toContain("/ws/sessions/42/coverage");

    act(() => {
      ws.open();
    });
    expect(result.current.isConnected).toBe(true);
    expect(ws.sent[0]).toBe(JSON.stringify({ type: "auth", token: "assessor-token" }));
  });

  test("applies coverage_update payloads to state", () => {
    const { result } = renderHook(() => useCoverageWebSocket(42));
    act(() => {
      connect().open();
    });

    act(() => {
      connect().message(
        JSON.stringify({
          type: "coverage_update",
          skills: [{ id: 1, skill_label: "Testing", state: "covered" }],
          discovered: [],
        }),
      );
    });

    expect(result.current.coverageMap?.skills).toHaveLength(1);
    expect(result.current.coverageMap?.skills[0].skill_label).toBe("Testing");
  });

  test("stops reconnecting once the session ends", () => {
    const { result } = renderHook(() => useCoverageWebSocket(42));
    const ws = connect();
    act(() => {
      ws.open();
    });

    act(() => {
      ws.message(JSON.stringify({ type: "session_status", status: "ended", end_reason: "abandoned" }));
    });
    expect(result.current.sessionEnded).toBe(true);
    expect(result.current.sessionEndReason).toBe("abandoned");

    act(() => {
      ws.close();
      vi.advanceTimersByTime(RECONNECT_DELAYS.reduce((a, b) => a + b, 0));
    });
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  test("retries with the shallow ladder while the session is still live", () => {
    renderHook(() => useCoverageWebSocket(42));

    act(() => {
      connect().close();
      vi.advanceTimersByTime(RECONNECT_DELAYS[0]);
    });
    expect(FakeWebSocket.instances).toHaveLength(2);

    act(() => {
      connect().close();
      vi.advanceTimersByTime(RECONNECT_DELAYS[1]);
    });
    expect(FakeWebSocket.instances).toHaveLength(3);
  });
});
