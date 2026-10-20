import { expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse, ws } from "msw";
import { API, server } from "./server";
import { renderApp } from "./render";
import { candidateInfo } from "./fixtures";

// What a functional test of the live candidate page needs that jsdom doesn't have: a microphone, a camera, a screen
// share, audio playback and the audio worklet, all faked here; the page, its hooks and services run for real, and the
// network is MSW (REST and the audio WebSocket). Each test file still mocks the connection check itself (vi.mock is
// per file): it measures third-party hosts, which isn't what's under test.

export const audioSocket = ws.link(/^ws:\/\/api\.test\/ws\/sessions\/42\/audio/);

export class FakeTrack extends EventTarget {
  readyState: "live" | "ended" = "live";
  constructor(readonly kind: "audio" | "video", private readonly displaySurface?: string) {
    super();
  }
  stop = () => {
    this.readyState = "ended";
  };
  getSettings = () => ({ displaySurface: this.displaySurface });
}

function fakeStream(track: FakeTrack) {
  return {
    getTracks: () => [track],
    getAudioTracks: () => (track.kind === "audio" ? [track] : []),
    getVideoTracks: () => (track.kind === "video" ? [track] : []),
  } as unknown as MediaStream;
}

class FakeAudioContext {
  state = "running";
  destination = {};
  currentTime = 0;
  audioWorklet = { addModule: async () => {} };
  resume = async () => {};
  close = async () => {};
  createOscillator = () => ({ connect() {}, start() {}, stop() {}, frequency: { setValueAtTime() {} } });
  createGain = () => ({ connect() {}, gain: { setValueAtTime() {} } });
  createMediaStreamSource = () => ({ connect() {} });
  createAnalyser = () => ({ fftSize: 0, frequencyBinCount: 4, getByteFrequencyData() {} });
  createBuffer = () => ({ copyToChannel() {}, getChannelData: () => new Float32Array(0) });
  createBufferSource = () => ({ connect() {}, start() {}, buffer: null, onended: null });
}

export class FakeAudioWorkletNode {
  static last: FakeAudioWorkletNode | null = null;
  port: { onmessage: ((e: { data: ArrayBuffer }) => void) | null } = { onmessage: null };
  constructor() {
    FakeAudioWorkletNode.last = this;
  }
  connect() {}
  disconnect() {}
  /** One frame from the microphone, as the worklet would post it. */
  speak() {
    this.port.onmessage?.({ data: new ArrayBuffer(8) });
  }
}

/**
 * Every stream the page asks for, so a test can find the interview's own microphone: the hardware check asks for
 * { audio: true }, the interview's capture for audio settings (16 kHz, echo cancellation).
 */
export let streams: { constraints: MediaStreamConstraints; track: FakeTrack }[] = [];

/** Fakes the devices; call in beforeEach, and vi.unstubAllGlobals() in afterEach. */
export function installDevices() {
  streams = [];
  FakeAudioWorkletNode.last = null;
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("AudioWorkletNode", FakeAudioWorkletNode);
  vi.stubGlobal("requestAnimationFrame", () => 0);
  vi.stubGlobal("cancelAnimationFrame", () => {});
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi.fn(async (constraints: MediaStreamConstraints) => {
        const track = new FakeTrack(constraints.video ? "video" : "audio");
        streams.push({ constraints, track });
        return fakeStream(track);
      }),
      getDisplayMedia: vi.fn(async () => fakeStream(new FakeTrack("video", "monitor"))),
    },
  });
}

/**
 * How many screens Chrome reports (screen.isExtended), and Chrome's "change" event when one is plugged in or out.
 * jsdom's Screen has neither.
 */
export function fakeScreens(extended: boolean) {
  const events = new EventTarget();
  let value = extended;
  Object.defineProperty(window.screen, "isExtended", { configurable: true, get: () => value });
  Object.defineProperty(window.screen, "addEventListener", { configurable: true, value: events.addEventListener.bind(events) });
  Object.defineProperty(window.screen, "removeEventListener", { configurable: true, value: events.removeEventListener.bind(events) });
  return {
    set(next: boolean) {
      value = next;
      events.dispatchEvent(new Event("change"));
    },
    remove() {
      for (const key of ["isExtended", "addEventListener", "removeEventListener"]) delete (window.screen as unknown as Record<string, unknown>)[key];
    },
  };
}

export type Client = {
  send: (data: string) => void;
  close: () => void;
  addEventListener: (type: "message", listener: (e: MessageEvent) => void) => void;
};

export const send = (client: Client, message: object) => client.send(JSON.stringify(message));

/** Opens the invite link and waits for the setup. Pass a Chrome user agent and proctoring for a proctored interview. */
export function openInvite(info: Partial<typeof candidateInfo> & { proctoring_required?: boolean } = {}, onConnect?: (client: Client) => void) {
  server.use(http.get(`${API}/sessions/tok-test-123/candidate`, () => HttpResponse.json({ ...candidateInfo, ...info })));
  if (onConnect) server.use(audioSocket.addEventListener("connection", ({ client }) => onConnect(client as unknown as Client)));
  renderApp("/interview/tok-test-123", { token: null });
}

/** Turns on the camera, shares the entire screen and ticks the notice, as a candidate would. */
export async function completeProctoringSetup() {
  await userEvent.click(await screen.findByRole("button", { name: "Turn on camera" }));
  await userEvent.click(await screen.findByRole("button", { name: "Share your entire screen" }));
  await userEvent.click(screen.getByRole("checkbox", { name: /I understand/ }));
}

/** Waits for Start to be enabled, presses it, and returns the interview's microphone track. */
export async function pressStart() {
  const start = await screen.findByRole("button", { name: "Start Interview" });
  await waitFor(() => expect(start).toBeEnabled(), { timeout: 10000 });
  await userEvent.click(start);

  let mic: FakeTrack | undefined;
  await waitFor(() => {
    mic = streams.find(({ constraints }) => typeof constraints.audio === "object")?.track;
    expect(mic).toBeDefined();
  });
  return mic!;
}
