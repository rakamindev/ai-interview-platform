import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAudioWebSocket } from './useAudioWebSocket';

// Mock WS_URL
vi.mock('@/services/api', () => ({ WS_URL: 'ws://localhost:3001' }));

// A tiny mock WebSocket that lets us control events
class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  readyState = 0;
  binaryType = '';
  onopen: (() => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => { this.readyState = MockWebSocket.CLOSED; });

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }
  simulateClose(code = 1006) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code });
  }
  simulateMessage(data: unknown) {
    this.onmessage?.({ data });
  }
  simulateError() {
    this.onerror?.();
  }
}

let mockWs: MockWebSocket;

let mockWs: MockWebSocket;

describe('useAudioWebSocket', () => {
  const defaultProps = {
    sessionId: 1,
    token: 'test-token',
    onAudioChunk: vi.fn(),
    onTranscript: vi.fn(),
    onStateChange: vi.fn(),
    onSpeakerChange: vi.fn(),
    onReconnected: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockWs = new MockWebSocket();
    vi.stubGlobal('WebSocket', vi.fn(() => mockWs));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('sets connectionState to "connecting" when connect() is called', () => {
    const { result } = renderHook(() => useAudioWebSocket(defaultProps));
    expect(result.current.connectionState).toBe('disconnected');

    act(() => { result.current.connect(); });
    expect(result.current.connectionState).toBe('connecting');
  });

  it('sets connectionState to "connected" when WebSocket opens', () => {
    const { result } = renderHook(() => useAudioWebSocket(defaultProps));
    act(() => { result.current.connect(); });
    act(() => { mockWs.simulateOpen(); });
    expect(result.current.connectionState).toBe('connected');
  });

  it('sends auth message on open when token is provided', () => {
    const { result } = renderHook(() => useAudioWebSocket(defaultProps));
    act(() => { result.current.connect(); });
    act(() => { mockWs.simulateOpen(); });
    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'auth', token: 'test-token' })
    );
  });

  it('triggers onStateChange("reconnecting") when WS closes unexpectedly', () => {
    const { result } = renderHook(() => useAudioWebSocket(defaultProps));
    act(() => { result.current.connect(); });
    act(() => { mockWs.simulateOpen(); });
    act(() => { mockWs.simulateClose(1006); });
    expect(defaultProps.onStateChange).toHaveBeenCalledWith('reconnecting');
  });

  it('does NOT trigger reconnecting when session_ended message was received', () => {
    const { result } = renderHook(() => useAudioWebSocket(defaultProps));
    act(() => { result.current.connect(); });
    act(() => { mockWs.simulateOpen(); });
    act(() => { mockWs.simulateMessage(JSON.stringify({ type: 'session_ended' })); });
    act(() => { mockWs.simulateClose(1000); });
    // Should be 'complete', not 'reconnecting'
    const calls = defaultProps.onStateChange.mock.calls.map(c => c[0]);
    expect(calls).toContain('complete');
    expect(calls).not.toContain('reconnecting');
  });

  it('transitions to complete after all reconnect attempts are exhausted', () => {
    const { result } = renderHook(() => useAudioWebSocket(defaultProps));
    act(() => { result.current.connect(); });
    act(() => { mockWs.simulateOpen(); });

    // Exhaust all 3 reconnect attempts [1000, 2000, 4000]
    for (let i = 0; i < 3; i++) {
      act(() => { mockWs.simulateClose(1006); });
      act(() => { vi.runAllTimers(); });
      act(() => { mockWs.simulateOpen(); });
    }
    act(() => { mockWs.simulateClose(1006); });

    const calls = defaultProps.onStateChange.mock.calls.map(c => c[0]);
    expect(calls[calls.length - 1]).toBe('complete');
  });
});
