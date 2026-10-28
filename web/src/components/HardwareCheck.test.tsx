import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HardwareCheck from "./HardwareCheck";

const speed = vi.hoisted(() => vi.fn());
vi.mock("@/utils/internetSpeedTest", () => ({
  testInternetSpeed: speed,
  DEFAULT_THRESHOLDS: { minDownloadMbps: 8, minUploadMbps: 4, maxPingMs: 300 },
}));

class PrecheckAudioContext {
  static instances: PrecheckAudioContext[] = [];
  static failPlayback = false;
  state = "running";
  currentTime = 0;
  destination = {};
  constructor() { PrecheckAudioContext.instances.push(this); }
  resume = async () => {};
  close = vi.fn(async () => { this.state = "closed"; });
  createMediaStreamSource = () => ({ connect() {} });
  createAnalyser = () => ({ fftSize: 256, frequencyBinCount: 2, getByteFrequencyData(data: Uint8Array) { data.fill(0); } });
  createGain = () => ({ connect() {}, gain: { setValueAtTime() {} } });
  createOscillator() {
    if (PrecheckAudioContext.failPlayback) throw new Error("Synthetic output failure");
    return { connect() {}, frequency: { setValueAtTime() {} }, start() {}, stop() {}, onended: null as (() => void) | null };
  }
}
const result = (passed: boolean) => ({ download: 20, upload: passed ? 8 : 1, ping: 30, passed, downloadTests: [], uploadTests: [], pingTests: [] });
const trackStop = vi.fn();
const stream = { getTracks: () => [{ stop: trackStop }] } as unknown as MediaStream;
const mic = vi.fn();
const advanceCheck = async () => act(async () => { await vi.advanceTimersByTimeAsync(800); });
const row = (label: string) => screen.getByText(label).parentElement!;

beforeEach(() => {
  vi.useFakeTimers();
  speed.mockReset().mockResolvedValue(result(true));
  mic.mockReset().mockResolvedValue(stream); trackStop.mockClear();
  PrecheckAudioContext.instances = []; PrecheckAudioContext.failPlayback = false;
  vi.stubGlobal("AudioContext", PrecheckAudioContext);
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: mic } });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("hardware check retry", () => {
  it("reruns OS and internet after failure and enables Start only after the new checks pass", async () => {
    speed.mockResolvedValueOnce(result(false));
    const onStart = vi.fn(); render(<HardwareCheck onStart={onStart} />);
    await advanceCheck();
    expect(row("Internet").textContent).toContain("Failed");
    expect((screen.getByRole("button", { name: "Start Interview" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect((screen.getByRole("button", { name: "Start Interview" }) as HTMLButtonElement).disabled).toBe(true);
    await advanceCheck();
    expect(speed).toHaveBeenCalledTimes(2);
    expect(row("OS & browser").textContent).toContain("Passed");
    expect(row("Microphone").textContent).toContain("Passed");
    const start = screen.getByRole("button", { name: "Start Interview" }) as HTMLButtonElement;
    expect(start.disabled).toBe(false); fireEvent.click(start); expect(onStart).toHaveBeenCalledOnce();
  });
  it("recovers from a denied microphone on Retry without reloading the page", async () => {
    mic.mockRejectedValueOnce(new Error("Synthetic permission denial"));
    render(<HardwareCheck />); await advanceCheck();
    expect(row("Microphone").textContent).toContain("Failed");
    fireEvent.click(screen.getByRole("button", { name: "Retry" })); await advanceCheck();
    expect(mic).toHaveBeenCalledTimes(2);
    expect((screen.getByRole("button", { name: "Start Interview" }) as HTMLButtonElement).disabled).toBe(false);
  });
  it("releases a microphone permission result arriving after the component unmounts", async () => {
    let grant!: (value: MediaStream) => void;
    mic.mockImplementationOnce(() => new Promise<MediaStream>(resolve => { grant = resolve; }));
    render(<HardwareCheck />); await advanceCheck(); cleanup();
    await act(async () => grant(stream));
    expect(trackStop).toHaveBeenCalledOnce();
    expect(PrecheckAudioContext.instances).toHaveLength(0);
  });
  it("stops the precheck stream, audio contexts, and animation when it unmounts", async () => {
    render(<HardwareCheck />); await advanceCheck(); cleanup();
    expect(trackStop).toHaveBeenCalledOnce();
    expect(PrecheckAudioContext.instances.every(context => context.state === "closed")).toBe(true);
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });
  it("releases resources from a failed audio attempt before Retry starts fresh", async () => {
    PrecheckAudioContext.failPlayback = true;
    render(<HardwareCheck />); await advanceCheck();
    expect(row("Audio output").textContent).toContain("Failed");
    const oldContexts = [...PrecheckAudioContext.instances];
    PrecheckAudioContext.failPlayback = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(trackStop).toHaveBeenCalledOnce();
    expect(oldContexts.every(context => context.state === "closed")).toBe(true);
    await advanceCheck();
    expect((screen.getByRole("button", { name: "Start Interview" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
