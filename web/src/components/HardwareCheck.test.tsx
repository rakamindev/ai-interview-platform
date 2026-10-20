import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HardwareCheck from "@/components/HardwareCheck";
import type { InternetSpeedResult } from "@/utils/internetSpeedTest";
import { createFakeMediaStream, installAudioContext, installMediaDevices, type FakeMediaStream } from "@/test/stubs";

const { testInternetSpeed } = vi.hoisted(() => ({ testInternetSpeed: vi.fn() }));

vi.mock("@/utils/internetSpeedTest", () => ({
    DEFAULT_THRESHOLDS: { minDownloadMbps: 8, minUploadMbps: 4, maxPingMs: 300 },
    testInternetSpeed: (thresholds: unknown) => testInternetSpeed(thresholds),
}));

const FAILED_SPEED: InternetSpeedResult = {
    download: 1.87,
    upload: 1.87,
    ping: 240,
    passed: false,
    downloadTests: [1.87],
    uploadTests: [1.87],
    pingTests: [240],
};

const PASSED_SPEED: InternetSpeedResult = {
    download: 24.5,
    upload: 9.1,
    ping: 40,
    passed: true,
    downloadTests: [24.5],
    uploadTests: [9.1],
    pingTests: [40],
};

const ROW_STATES = ["Passed", "Failed", "Waiting", "Checking..."] as const;

const ROW_LABELS = {
    osAndBrowser: "OS & browser",
    internet: "Internet",
    microphone: "Microphone",
    audio: "Audio output",
} as const;

type RowKey = keyof typeof ROW_LABELS;

const MIC_ROWS: RowKey[] = ["osAndBrowser", "internet", "microphone", "audio"];

/** Falls back to the visible label so the assertions describe behaviour, not markup. */
function rowElement(key: RowKey): HTMLElement {
    const byTestId = screen.queryByTestId(`row-${key}`);
    if (byTestId) return byTestId;

    const label = screen.getByText(ROW_LABELS[key], { selector: "span" });
    const container = label.parentElement?.parentElement;
    if (!container) throw new Error(`No row container for ${key}`);
    return container;
}

function rowState(key: RowKey): string {
    const text = rowElement(key).textContent ?? "";
    return ROW_STATES.find((state) => text.includes(state)) ?? "unknown";
}

function startButton(): HTMLElement {
    return screen.getByRole("button", { name: "Start Interview" });
}

function retryButton(): HTMLElement {
    return screen.getByRole("button", { name: "Retry" });
}

async function advance(ms: number) {
    await act(async () => {
        vi.advanceTimersByTime(ms);
    });
}

/**
 * `fireEvent` is used instead of `userEvent` because userEvent deadlocks under
 * fake timers in this stack; the click still goes through React's event system.
 */
function press(element: HTMLElement) {
    fireEvent.click(element);
}

/** Acquires the microphone stream for real so the component's cleanup is observable. */
function recordAcquiredStreams(): FakeMediaStream[] {
    const streams: FakeMediaStream[] = [];
    installMediaDevices(async () => {
        const stream = createFakeMediaStream(["audio"]);
        streams.push(stream);
        return stream;
    });
    return streams;
}

describe("HardwareCheck", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        testInternetSpeed.mockResolvedValue(FAILED_SPEED);
        installAudioContext();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("restarts the checklist after a failed check when Retry is pressed", async () => {
        render(<HardwareCheck />);

        await advance(800);

        expect(testInternetSpeed).toHaveBeenCalledTimes(1);
        expect(rowState("internet")).toBe("Failed");
        expect(startButton()).toBeDisabled();

        press(retryButton());

        // The retry is in flight, so it cannot be pressed a second time.
        expect(rowState("osAndBrowser")).toBe("Checking...");
        expect(retryButton()).toBeDisabled();

        await advance(800);

        expect(testInternetSpeed).toHaveBeenCalledTimes(2);
        expect(rowState("osAndBrowser")).toBe("Passed");
        expect(rowState("internet")).toBe("Failed");
        expect(rowState("microphone")).toBe("Waiting");
    });

    it("reaches every passed row once the network recovers", async () => {
        const onStart = vi.fn();
        render(<HardwareCheck onStart={onStart} />);

        await advance(800);
        expect(rowState("internet")).toBe("Failed");

        testInternetSpeed.mockResolvedValue(PASSED_SPEED);
        press(retryButton());
        await advance(800);
        await act(async () => {});

        for (const key of MIC_ROWS) {
            expect(rowState(key)).toBe("Passed");
        }

        expect(startButton()).toBeEnabled();

        press(startButton());
        expect(onStart).toHaveBeenCalledTimes(1);
    });

    it("stops the microphone stream it already acquired when it retries", async () => {
        const streams = recordAcquiredStreams();
        testInternetSpeed.mockResolvedValue(PASSED_SPEED);
        // Audio output cannot be verified, so the checklist fails after the microphone passed.
        installAudioContext({
            createOscillator: () => {
                throw new Error("audio output blocked");
            },
        });

        render(<HardwareCheck />);

        await advance(800);
        await act(async () => {});

        expect(rowState("microphone")).toBe("Passed");
        expect(rowState("audio")).toBe("Failed");
        expect(streams).toHaveLength(1);

        press(retryButton());

        expect(streams[0]._tracks[0].stop).toHaveBeenCalledTimes(1);
    });

    it("stops the microphone stream when it unmounts", async () => {
        const streams = recordAcquiredStreams();
        testInternetSpeed.mockResolvedValue(PASSED_SPEED);

        const { unmount } = render(<HardwareCheck />);
        await advance(800);
        await act(async () => {});

        expect(rowState("microphone")).toBe("Passed");
        expect(streams[0]._tracks[0].stop).not.toHaveBeenCalled();

        unmount();

        expect(streams[0]._tracks[0].stop).toHaveBeenCalledTimes(1);
    });
});
