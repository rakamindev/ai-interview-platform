import { vi, type Mock } from "vitest";

/**
 * Browser APIs jsdom does not implement, as overridable factories.
 *
 * Each factory returns a fresh double so a test can install one stub with its
 * own behaviour instead of inheriting the default from `setup.ts`.
 */

export interface FakeTrack {
    kind: string;
    enabled: boolean;
    readyState: string;
    stop: Mock;
}

export interface FakeMediaStream {
    _tracks: FakeTrack[];
    active: boolean;
    id: string;
    getTracks: () => FakeTrack[];
    getAudioTracks: () => FakeTrack[];
    getVideoTracks: () => FakeTrack[];
    addTrack: (track: FakeTrack) => void;
}

export function createFakeMediaStream(trackKinds: string[] = ["audio", "video"]): FakeMediaStream {
    const tracks: FakeTrack[] = trackKinds.map((kind) => ({
        kind,
        enabled: true,
        readyState: "live",
        stop: vi.fn(),
    }));

    return {
        _tracks: tracks,
        active: true,
        id: "fake-stream",
        getTracks: () => tracks,
        getAudioTracks: () => tracks.filter((t) => t.kind === "audio"),
        getVideoTracks: () => tracks.filter((t) => t.kind === "video"),
        addTrack: (track: FakeTrack) => tracks.push(track),
    };
}

export function installMediaStream() {
    class MediaStreamStub implements FakeMediaStream {
        _tracks: FakeTrack[];
        active = true;
        id = "fake-stream";

        constructor(tracks: FakeTrack[] = createFakeMediaStream()._tracks) {
            this._tracks = tracks;
        }

        getTracks() {
            return this._tracks;
        }

        getAudioTracks() {
            return this._tracks.filter((t) => t.kind === "audio");
        }

        getVideoTracks() {
            return this._tracks.filter((t) => t.kind === "video");
        }

        addTrack(track: FakeTrack) {
            this._tracks.push(track);
        }
    }

    vi.stubGlobal("MediaStream", MediaStreamStub);
    return MediaStreamStub;
}

export interface FakeGainNode {
    gain: { setValueAtTime: Mock; value: number };
    connect: Mock;
}

export interface FakeOscillatorNode {
    frequency: { setValueAtTime: Mock };
    connect: Mock;
    start: Mock;
    stop: Mock;
}

export interface FakeAnalyserNode {
    fftSize: number;
    frequencyBinCount: number;
    connect: Mock;
    getByteFrequencyData: (data: Uint8Array) => void;
}

export interface FakeAudioContext {
    state: string;
    currentTime: number;
    sampleRate: number;
    destination: Record<string, never>;
    createOscillator: () => FakeOscillatorNode;
    createGain: () => FakeGainNode;
    createAnalyser: () => FakeAnalyserNode;
    createMediaStreamSource: () => { connect: Mock };
    resume: Mock;
    close: Mock;
}

export function createFakeAudioContext(overrides: Partial<FakeAudioContext> = {}): FakeAudioContext {
    return {
        state: "running",
        currentTime: 0,
        sampleRate: 48000,
        destination: {},
        createOscillator: () => ({
            frequency: { setValueAtTime: vi.fn() },
            connect: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
        }),
        createGain: () => ({
            gain: { setValueAtTime: vi.fn(), value: 1 },
            connect: vi.fn(),
        }),
        createAnalyser: () => ({
            fftSize: 256,
            frequencyBinCount: 128,
            connect: vi.fn(),
            getByteFrequencyData: (data: Uint8Array) => data.fill(0),
        }),
        createMediaStreamSource: () => ({ connect: vi.fn() }),
        resume: vi.fn(async () => undefined),
        close: vi.fn(async () => undefined),
        ...overrides,
    };
}

/**
 * Installs a constructor-shaped `AudioContext`. `new AudioContext()` yields the
 * fake object itself, so tests can inspect every context the component created.
 */
export function installAudioContext(overrides: Partial<FakeAudioContext> = {}) {
    const created: FakeAudioContext[] = [];

    function AudioContextStub(this: unknown) {
        const context = createFakeAudioContext(overrides);
        created.push(context);
        return context;
    }

    vi.stubGlobal("AudioContext", AudioContextStub);
    window.AudioContext = AudioContextStub as unknown as typeof window.AudioContext;
    return { created };
}

export function installMatchMedia(matches = false) {
    const stub = vi.fn((query: string) => ({
        matches,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
    }));

    vi.stubGlobal("matchMedia", stub);
    window.matchMedia = stub as unknown as typeof window.matchMedia;
    return stub;
}

export function installResizeObserver() {
    const observe = vi.fn();
    const unobserve = vi.fn();
    const disconnect = vi.fn();

    class ResizeObserverStub {
        observe = observe;
        unobserve = unobserve;
        disconnect = disconnect;
    }

    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    return { observe, unobserve, disconnect };
}

export function installMediaElementPlayback() {
    const play = vi.fn(async () => undefined);
    const pause = vi.fn();
    const original = {
        play: window.HTMLMediaElement.prototype.play,
        pause: window.HTMLMediaElement.prototype.pause,
    };

    window.HTMLMediaElement.prototype.play = play as unknown as HTMLMediaElement["play"];
    window.HTMLMediaElement.prototype.pause = pause as unknown as HTMLMediaElement["pause"];

    return { play, pause, restore: () => Object.assign(window.HTMLMediaElement.prototype, original) };
}

export function installMediaDevices(
    handler: (constraints: MediaStreamConstraints) => Promise<FakeMediaStream> = async () => createFakeMediaStream()
) {
    const getUserMedia = vi.fn(async (constraints: MediaStreamConstraints) => handler(constraints));
    const enumerateDevices = vi.fn(async () => []);

    Object.defineProperty(window.navigator, "mediaDevices", {
        configurable: true,
        writable: true,
        value: { getUserMedia, enumerateDevices },
    });

    return { getUserMedia, enumerateDevices };
}

/**
 * jsdom implements neither pointer capture nor layout scrolling; Radix Select
 * calls both while opening.
 */
export function installPointerCapture() {
    const setPointerCapture = vi.fn();
    const releasePointerCapture = vi.fn();
    const hasPointerCapture = vi.fn(() => false);

    Object.assign(Element.prototype, { setPointerCapture, releasePointerCapture, hasPointerCapture });
    return { setPointerCapture, releasePointerCapture, hasPointerCapture };
}

export function installScrollIntoView() {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView as unknown as Element["scrollIntoView"];
    return scrollIntoView;
}

export function installAnimationFrame() {
    let nextHandle = 0;
    const callbacks = new Map<number, FrameRequestCallback>();
    const requestAnimationFrameStub = vi.fn((callback: FrameRequestCallback) => {
        nextHandle += 1;
        callbacks.set(nextHandle, callback);
        return nextHandle;
    });
    const cancelAnimationFrameStub = vi.fn((handle: number) => {
        callbacks.delete(handle);
    });

    vi.stubGlobal("requestAnimationFrame", requestAnimationFrameStub);
    vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrameStub);
    window.requestAnimationFrame = requestAnimationFrameStub as unknown as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = cancelAnimationFrameStub as unknown as typeof window.cancelAnimationFrame;

    return {
        requestAnimationFrame: requestAnimationFrameStub,
        cancelAnimationFrame: cancelAnimationFrameStub,
        callbacks,
    };
}

/** Installs every default stub. Called once from `setup.ts`. */
export function installBrowserStubs() {
    installMatchMedia();
    installResizeObserver();
    installMediaElementPlayback();
    installMediaDevices();
    installMediaStream();
    installAudioContext();
    installAnimationFrame();
    installPointerCapture();
    installScrollIntoView();
}
