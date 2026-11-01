import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCoverageWebSocket } from "@/hooks/useCoverageWebSocket";

class FakeWebSocket {
  static OPEN = 1;
  static instances: FakeWebSocket[] = [];

  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  send = vi.fn();

  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }

  close() {
    this.readyState = 3;
    this.onclose?.();
  }

  serverOpen() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  serverClose() {
    this.readyState = 3;
    this.onclose?.();
  }
}

const latestSocket = () => FakeWebSocket.instances[FakeWebSocket.instances.length - 1];

describe("useCoverageWebSocket", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function failEveryAttempt() {
    for (const delay of [1000, 2000, 4000]) {
      act(() => latestSocket().serverClose());
      act(() => vi.advanceTimersByTime(delay));
    }
    act(() => latestSocket().serverClose());
  }

  it("reports a lost connection once automatic reconnects are exhausted", () => {
    const { result } = renderHook(() => useCoverageWebSocket(3));

    failEveryAttempt();

    expect(FakeWebSocket.instances).toHaveLength(4);
    expect(result.current.connectionFailed).toBe(true);
    expect(result.current.isConnected).toBe(false);
  });

  it("reconnects on request after giving up", () => {
    const { result } = renderHook(() => useCoverageWebSocket(3));
    failEveryAttempt();

    act(() => result.current.reconnect());
    act(() => latestSocket().serverOpen());

    expect(FakeWebSocket.instances).toHaveLength(5);
    expect(result.current.connectionFailed).toBe(false);
    expect(result.current.isConnected).toBe(true);
  });
});
