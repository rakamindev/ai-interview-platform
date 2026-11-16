/** Controllable WebSocket stand-in. Install with vi.stubGlobal("WebSocket", MockWebSocket). */
export class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];
  static reset() {
    MockWebSocket.instances = [];
  }
  static get last() {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1];
  }

  readyState = MockWebSocket.CONNECTING;
  binaryType = "blob";
  sent: unknown[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }

  send(data: unknown) {
    this.sent.push(data);
  }
  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  // --- test helpers ---
  open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }
  message(data: unknown) {
    this.onmessage?.({ data: typeof data === "object" && !(data instanceof ArrayBuffer) ? JSON.stringify(data) : data });
  }
  drop() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }
}
