/**
 * Shared Vitest setup for the web app.
 *
 * - Registers jest-dom matchers (toBeInTheDocument, etc.).
 * - Provides default browser-API stubs that jsdom does not implement
 *   (matchMedia, ResizeObserver, AudioContext, getUserMedia, WebSocket,
 *   clipboard). Tests may override any stub per-test via `vi.stubGlobal`
 *   or by reassigning properties; they are responsible for restoring
 *   overrides if they call `vi.unstubAllGlobals()`.
 */
import "@testing-library/jest-dom/vitest";
import { vi } from "vite-plus/test";

if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// --- ResizeObserver (Radix UI / dnd-kit) -----------------------------------
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal("ResizeObserver", MockResizeObserver);

class MockAudioContext {
  static instances: MockAudioContext[] = [];

  state = "running";
  currentTime = 0;
  destination = {};
  audioWorklet = { addModule: vi.fn().mockResolvedValue(undefined) };

  constructor(_options?: unknown) {
    MockAudioContext.instances.push(this);
  }

  createMediaStreamSource(_stream: unknown) {
    return { connect: vi.fn(), disconnect: vi.fn() };
  }

  createBuffer(channels: number, length: number, sampleRate: number) {
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      duration: length / sampleRate,
      copyToChannel: vi.fn(),
      getChannelData: () => new Float32Array(length),
    };
  }

  createBufferSource() {
    return {
      buffer: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }

  createAnalyser() {
    return {
      fftSize: 2048,
      frequencyBinCount: 128,
      getByteFrequencyData: vi.fn(),
      getByteTimeDomainData: vi.fn(),
      getFloatTimeDomainData: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }

  createOscillator() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
      frequency: { setValueAtTime: vi.fn() },
      start: vi.fn(),
      stop: vi.fn(),
    };
  }

  createGain() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
      gain: { setValueAtTime: vi.fn() },
    };
  }

  close() {
    this.state = "closed";
    return Promise.resolve();
  }

  resume() {
    this.state = "running";
    return Promise.resolve();
  }

  suspend() {
    this.state = "suspended";
    return Promise.resolve();
  }
}
vi.stubGlobal("AudioContext", MockAudioContext);

class MockAudioWorkletNode {
  port: { onmessage: unknown; postMessage: ReturnType<typeof vi.fn> };
  disconnect = vi.fn();
  connect = vi.fn();

  constructor(_context: unknown, _name: string) {
    this.port = { onmessage: null, postMessage: vi.fn() };
  }
}
vi.stubGlobal("AudioWorkletNode", MockAudioWorkletNode);

const fakeStream = {
  id: "mock-stream",
  active: true,
  getTracks: () => [{ stop: vi.fn(), getSettings: () => ({}) }],
  getAudioTracks: () => [],
  getVideoTracks: () => [],
  addTrack: vi.fn(),
  removeTrack: vi.fn(),
  clone: vi.fn(),
};
Object.defineProperty(navigator, "mediaDevices", {
  configurable: true,
  value: {
    getUserMedia: vi.fn().mockResolvedValue(fakeStream),
  },
});

Object.defineProperty(navigator, "clipboard", {
  configurable: true,
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(""),
  },
});

export class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  url: string;
  binaryType: string = "blob";
  readyState = MockWebSocket.OPEN;
  onopen: ((event?: unknown) => void) | null = null;
  onmessage: ((event?: { data: string }) => void) | null = null;
  onclose: ((event?: unknown) => void) | null = null;
  onerror: ((event?: unknown) => void) | null = null;
  send = vi.fn();
  close = vi.fn();

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  /** Test helper: simulate the server opening the socket. */
  serverOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.({});
  }

  /** Test helper: simulate an incoming message frame. */
  serverMessage(data: string) {
    this.onmessage?.({ data });
  }

  /** Test helper: simulate the socket closing. */
  serverClose() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({});
  }
}
vi.stubGlobal("WebSocket", MockWebSocket);

if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = vi.fn();
}
if (!window.scrollTo) {
  window.scrollTo = vi.fn();
}

// jsdom lacks pointer capture; Radix Select calls these on the trigger when opening.
if (!HTMLElement.prototype.hasPointerCapture) {
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.releasePointerCapture = () => {};
  HTMLElement.prototype.setPointerCapture = () => {};
}
