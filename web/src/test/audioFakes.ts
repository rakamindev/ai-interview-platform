export class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  static userGesture = false;
  static enforceAutoplay = false;
  static startSuspended = false;
  static moduleError: Error | null = null;

  state: AudioContextState;
  sampleRate: number;
  destination = {};
  scheduled: { samples: Float32Array; time: number }[] = [];
  private createdAt = Date.now();
  audioWorklet = {
    addModule: async () => {
      if (FakeAudioContext.moduleError) throw FakeAudioContext.moduleError;
    },
  };

  constructor(options: AudioContextOptions = {}) {
    this.sampleRate = options.sampleRate ?? 48000;
    this.state = FakeAudioContext.startSuspended ||
      (FakeAudioContext.enforceAutoplay && !FakeAudioContext.userGesture)
      ? "suspended" : "running";
    FakeAudioContext.instances.push(this);
  }

  get currentTime() {
    return this.state === "running" ? (Date.now() - this.createdAt) / 1000 : 0;
  }

  resume() {
    if (FakeAudioContext.enforceAutoplay && !FakeAudioContext.userGesture) {
      return new Promise<void>(() => {});
    }
    this.state = "running";
    return Promise.resolve();
  }

  async close() { this.state = "closed"; }
  createMediaStreamSource() { return { connect() {}, disconnect() {} }; }

  createBuffer(_channels: number, length: number, sampleRate: number) {
    return {
      duration: length / sampleRate,
      samples: new Float32Array(length),
      copyToChannel(samples: Float32Array) { this.samples.set(samples); },
    };
  }

  createBufferSource() {
    const ctx = this;
    return {
      buffer: null as ReturnType<FakeAudioContext["createBuffer"]> | null,
      connect() {},
      start(time: number) {
        if (this.buffer) ctx.scheduled.push({ samples: this.buffer.samples, time });
      },
    };
  }

  static reset() {
    this.instances = [];
    this.userGesture = false;
    this.enforceAutoplay = false;
    this.startSuspended = false;
    this.moduleError = null;
    FakeWorklet.instances = [];
  }
}

export class FakeWorklet {
  static instances: FakeWorklet[] = [];
  port = { onmessage: null as ((event: { data: ArrayBuffer }) => void) | null };
  private connectedToOutput = false;
  constructor(public context: FakeAudioContext) { FakeWorklet.instances.push(this); }
  connect(destination: unknown) {
    this.connectedToOutput = destination === this.context.destination;
  }
  disconnect() { this.connectedToOutput = false; }
  emit(samples: Int16Array) {
    if (this.context.state === "running" && this.connectedToOutput) {
      this.port.onmessage?.({ data: samples.buffer as ArrayBuffer });
    }
  }
}

export class FakeWebSocket {
  static OPEN = 1;
  static instances: FakeWebSocket[] = [];
  readyState = 0;
  binaryType = "";
  sent: (string | ArrayBuffer)[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string | ArrayBuffer }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) { FakeWebSocket.instances.push(this); }
  open() { this.readyState = 1; this.onopen?.(); }
  receive(data: object | ArrayBuffer) {
    this.onmessage?.({ data: data instanceof ArrayBuffer ? data : JSON.stringify(data) });
  }
  send(data: string | ArrayBuffer) { this.sent.push(data); }
  close() { this.readyState = 3; this.onclose?.(); }
}
