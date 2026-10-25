import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HardwareCheck from "@/components/HardwareCheck";
import { testInternetSpeed, DEFAULT_THRESHOLDS } from "@/utils/internetSpeedTest";
import type { InternetSpeedResult } from "@/utils/internetSpeedTest";

vi.mock("@/utils/internetSpeedTest", () => ({
    testInternetSpeed: vi.fn(),
    DEFAULT_THRESHOLDS: { minDownloadMbps: 8, minUploadMbps: 4, maxPingMs: 300 },
}));

const mockSpeed = testInternetSpeed as ReturnType<typeof vi.fn>;

function speedResult(overrides: Partial<InternetSpeedResult> = {}): InternetSpeedResult {
    return {
        download: 25,
        upload: 12,
        ping: 40,
        passed: true,
        unavailable: false,
        downloadTests: [25, 26, 24],
        uploadTests: [12, 13, 11],
        pingTests: [40, 41, 39],
        ...overrides,
    };
}

class FakeAnalyser {
    fftSize = 256;
    frequencyBinCount = 32;
    disconnect = vi.fn();
    getByteFrequencyData(data: Uint8Array) {
        data.fill(0);
    }
}

class FakeOscillator {
    onended: (() => void) | null = null;
    connect = vi.fn();
    disconnect = vi.fn();
    start = vi.fn();
    stop = vi.fn(() => queueMicrotask(() => this.onended?.()));
    frequency = { setValueAtTime: vi.fn() };
}

class FakeAudioContext {
    static instances: FakeAudioContext[] = [];
    state = "running";
    currentTime = 0;
    destination = {};
    resume = vi.fn().mockResolvedValue(undefined);
    close = vi.fn().mockImplementation(async () => { this.state = "closed"; });
    source = { connect: vi.fn(), disconnect: vi.fn() };
    analyser = new FakeAnalyser();
    oscillator = new FakeOscillator();
    gain = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        gain: { setValueAtTime: vi.fn() },
    };
    constructor() {
        FakeAudioContext.instances.push(this);
    }
    createOscillator = () => this.oscillator;
    createGain = () => ({
        ...this.gain,
    });
    createMediaStreamSource = () => this.source;
    createAnalyser = () => this.analyser;
}

const fakeStream = {
    getTracks: () => [],
    getAudioTracks: () => [],
    getVideoTracks: () => [],
} as unknown as MediaStream;

beforeEach(() => {
    FakeAudioContext.instances = [];
    mockSpeed.mockReset();
    mockSpeed.mockResolvedValue(speedResult());
    Object.defineProperty(navigator, "mediaDevices", {
        value: { getUserMedia: vi.fn().mockResolvedValue(fakeStream) },
        configurable: true,
    });
    vi.stubGlobal("AudioContext", FakeAudioContext);
    // The mic level monitor schedules itself via requestAnimationFrame; noop it in jsdom
    // (otherwise it loops forever and keeps the test's event loop busy).
    vi.stubGlobal("requestAnimationFrame", () => 0);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
});

async function waitForStartEnabled() {
    await waitFor(
        () => expect(screen.getByRole("button", { name: /Start Interview/i })).toBeEnabled(),
        { timeout: 4000 }
    );
}

describe("HardwareCheck — internet check (F-13)", () => {
    it("proceeds normally when the speed test passes", async () => {
        render(<HardwareCheck onStart={vi.fn()} />);

        // OS & browser step completes after ~800ms, then the internet check runs.
        await screen.findByText("↓ 25 Mbps", {}, { timeout: 4000 });
        expect(screen.getAllByText("Passed").length).toBeGreaterThanOrEqual(2);
        await waitForStartEnabled();
    });

    it("skips the internet check with a warning when the speed test is unavailable, and still allows starting", async () => {
        mockSpeed.mockResolvedValue(
            speedResult({ passed: false, unavailable: true, download: 0, upload: 0, ping: 999 })
        );

        render(<HardwareCheck onStart={vi.fn()} />);

        await screen.findByText(/Speed test unavailable/, {}, { timeout: 4000 });
        expect(screen.getByText("Skipped")).toBeInTheDocument();
        // No fabricated speed numbers for an unmeasurable connection.
        expect(screen.queryByText(/Mbps/)).not.toBeInTheDocument();
        await waitForStartEnabled();
    });

    it("blocks start when internet is measured below threshold (not unavailable)", async () => {
        mockSpeed.mockResolvedValue(
            speedResult({ passed: false, unavailable: false, download: 1.2, upload: 0.8, ping: 500 })
        );

        render(<HardwareCheck onStart={vi.fn()} />);

        await screen.findByText("Failed", {}, { timeout: 4000 });
        expect(screen.queryByText(/Speed test unavailable/)).not.toBeInTheDocument();
        // Chain stops at internet → camera/mic never load → start stays disabled, retry offered.
        expect(screen.getByRole("button", { name: /Start Interview/i })).toBeDisabled();
        expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument();
    });
});

describe("HardwareCheck — microphone ownership", () => {
    function liveTrack(deviceId = "mic-1") {
        return {
            kind: "audio",
            label: "Built-in Microphone",
            readyState: "live",
            stop: vi.fn(),
            getSettings: () => ({ deviceId }),
        } as unknown as MediaStreamTrack;
    }

    function streamWith(track: MediaStreamTrack, videoTracks: MediaStreamTrack[] = []) {
        return {
            id: "verified-stream",
            getTracks: () => [track, ...videoTracks],
            getAudioTracks: () => [track],
            getVideoTracks: () => videoTracks,
        } as unknown as MediaStream;
    }

    it("hands off the verified live track without reacquiring or stopping it on unmount", async () => {
        const track = liveTrack();
        const videoTrack = {
            kind: "video",
            readyState: "live",
            stop: vi.fn(),
        } as unknown as MediaStreamTrack;
        const stream = streamWith(track, [videoTrack]);
        const getUserMedia = vi.fn().mockResolvedValue(stream);
        Object.defineProperty(navigator, "mediaDevices", {
            value: { getUserMedia },
            configurable: true,
        });
        vi.stubGlobal("MediaStream", class {
            private tracks: MediaStreamTrack[];
            constructor(tracks: MediaStreamTrack[]) { this.tracks = tracks; }
            getTracks = () => this.tracks;
            getAudioTracks = () => this.tracks;
            getVideoTracks = () => [];
        });
        const onStart = vi.fn();
        const view = render(<HardwareCheck onStart={onStart} />);

        await waitForStartEnabled();
        await userEvent.click(screen.getByRole("button", { name: /Start Interview/i }));

        expect(getUserMedia).toHaveBeenCalledTimes(1);
        expect(onStart).toHaveBeenCalledTimes(1);
        const handoff = onStart.mock.calls[0][0];
        expect(handoff.stream.getAudioTracks()).toEqual([track]);
        expect(handoff.deviceId).toBe("mic-1");
        expect(videoTrack.stop).toHaveBeenCalledTimes(1);
        expect(cancelAnimationFrame).toHaveBeenCalled();
        view.unmount();
        expect(track.stop).not.toHaveBeenCalled();
    });

    it("stops an untransferred stream and closes preflight resources exactly once on unmount", async () => {
        const track = liveTrack();
        const stream = streamWith(track);
        Object.defineProperty(navigator, "mediaDevices", {
            value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
            configurable: true,
        });
        const view = render(<HardwareCheck onStart={vi.fn()} />);

        await waitForStartEnabled();
        view.unmount();

        expect(track.stop).toHaveBeenCalledTimes(1);
        expect(cancelAnimationFrame).toHaveBeenCalledTimes(1);
        expect(FakeAudioContext.instances.every((context) => context.close.mock.calls.length === 1)).toBe(true);
    });

    it("hands an ended verified track to capture so the device-aware fallback can run", async () => {
        const track = liveTrack();
        Object.defineProperty(track, "readyState", { value: "ended", configurable: true });
        const stream = streamWith(track);
        Object.defineProperty(navigator, "mediaDevices", {
            value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
            configurable: true,
        });
        const onStart = vi.fn();
        render(<HardwareCheck onStart={onStart} />);

        await waitForStartEnabled();
        await userEvent.click(screen.getByRole("button", { name: /Start Interview/i }));

        expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ stream }));
        expect(track.stop).not.toHaveBeenCalled();
    });

    it("stops media that resolves after unmount", async () => {
        const track = liveTrack();
        const stream = streamWith(track);
        let resolveStream!: (stream: MediaStream) => void;
        const pending = new Promise<MediaStream>((resolve) => { resolveStream = resolve; });
        Object.defineProperty(navigator, "mediaDevices", {
            value: { getUserMedia: vi.fn().mockReturnValue(pending) },
            configurable: true,
        });
        const view = render(<HardwareCheck onStart={vi.fn()} />);

        await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled(), { timeout: 4000 });
        view.unmount();
        resolveStream(stream);

        await waitFor(() => expect(track.stop).toHaveBeenCalledTimes(1));
    });
});
