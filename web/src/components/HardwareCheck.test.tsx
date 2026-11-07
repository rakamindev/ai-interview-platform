import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HardwareCheck, { type HardwareCheckProps } from "./HardwareCheck";
import type { NetworkSample } from "@/utils/readiness";

const goodNet: NetworkSample = { downloadMbps: 78.5, uploadMbps: 31.7, latencyMs: 11 };
// Real reading from the case study that the old check blocked.
const weakNet: NetworkSample = { downloadMbps: 12.22, uploadMbps: 0.4, latencyMs: 393 };
const deadNet: NetworkSample = { downloadMbps: null, uploadMbps: null, latencyMs: null };

const fakeStream = () => ({ getTracks: () => [{ stop: vi.fn() }] }) as unknown as MediaStream;

function setup(overrides: Partial<HardwareCheckProps> = {}) {
    const props = {
        measure: vi.fn(async () => goodNet),
        requestMedia: vi.fn(async () => fakeStream()),
        checkAudioOutput: vi.fn(async () => true),
        onStart: vi.fn(),
        onReadiness: vi.fn(),
        ...overrides,
    };
    render(<HardwareCheck {...props} />);
    return props;
}

const row = (label: string) => screen.getByTestId(`check-${label}`);
const startButton = () => screen.getByRole("button", { name: /start interview/i });

describe("HardwareCheck", () => {
    it("shows OS & browser as passed on the first render, without depending on a timer", () => {
        // Regression for the check that sat on "Checking..." for minutes: with timers
        // frozen and the network test never finishing, this row must already be done.
        vi.useFakeTimers();
        try {
            setup({ measure: vi.fn(() => new Promise<NetworkSample>(() => {})) });
            expect(within(row("OS & browser")).getByText("Passed")).toBeInTheDocument();
        } finally {
            vi.useRealTimers();
        }
    });

    it("lets a candidate on a weak connection start, with a warning and tips", async () => {
        setup({ measure: vi.fn(async () => weakNet) });

        await waitFor(() => expect(startButton()).toBeEnabled());
        expect(within(row("Internet")).getByText("Weak")).toBeInTheDocument();
        expect(screen.getByText(/upload speed is low/i)).toBeInTheDocument();
        expect(screen.getByText(/you can still start/i)).toBeInTheDocument();
    });

    it("blocks start when the server cannot be reached, but still tests the microphone", async () => {
        setup({ measure: vi.fn(async () => deadNet) });

        await within(row("Internet")).findByText("Failed");
        await within(row("Microphone")).findByText("Passed");
        expect(startButton()).toBeDisabled();
        expect(screen.getByText(/couldn't reach the interview server/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    });

    it("treats a crashed measurement as a failed check, never as a pass", async () => {
        setup({ measure: vi.fn(async () => { throw new Error("network blew up"); }) });

        await within(row("Internet")).findByText("Failed");
        expect(startButton()).toBeDisabled();
    });

    it("re-runs only the network test on retry and lets the candidate start once it recovers", async () => {
        const measure = vi.fn<() => Promise<NetworkSample>>()
            .mockResolvedValueOnce(deadNet)
            .mockResolvedValueOnce(goodNet);
        const props = setup({ measure });

        await within(row("Internet")).findByText("Failed");
        await userEvent.click(screen.getByRole("button", { name: /retry/i }));
        await within(row("Internet")).findByText("Passed");

        expect(measure).toHaveBeenCalledTimes(2);
        expect(props.requestMedia).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(startButton()).toBeEnabled());
        await userEvent.click(startButton());
        expect(props.onStart).toHaveBeenCalledTimes(1);
    });

    it("explains how to fix a blocked microphone and keeps start disabled", async () => {
        setup({ requestMedia: vi.fn(async () => null) });

        await within(row("Microphone")).findByText("Failed");
        expect(screen.getByText(/allow access/i)).toBeInTheDocument();
        expect(startButton()).toBeDisabled();
    });

    it("reports the retried run with its new result, not the stale one", async () => {
        // Regression: clicking Retry re-rendered with the old "Failed" state still in place,
        // which was reported as the new attempt; the real (passing) result was never sent.
        const measure = vi.fn<() => Promise<NetworkSample>>()
            .mockResolvedValueOnce(deadNet)
            .mockResolvedValueOnce(goodNet);
        const props = setup({ measure });

        await waitFor(() => expect(props.onReadiness).toHaveBeenCalledTimes(1));
        expect(props.onReadiness).toHaveBeenLastCalledWith(expect.objectContaining({ verdict: "fail" }));

        await userEvent.click(screen.getByRole("button", { name: /retry/i }));
        await within(row("Internet")).findByText("Passed");

        await waitFor(() => expect(props.onReadiness).toHaveBeenCalledTimes(2));
        expect(props.onReadiness).toHaveBeenLastCalledWith(
            expect.objectContaining({
                verdict: "pass",
                network: { download_mbps: 78.5, upload_mbps: 31.7, latency_ms: 11 },
            }),
        );
    });

    it("reports each settled run to the assessor exactly once, with the measured numbers", async () => {
        const props = setup({ measure: vi.fn(async () => weakNet) });

        await waitFor(() => expect(props.onReadiness).toHaveBeenCalledTimes(1));
        expect(props.onReadiness).toHaveBeenCalledWith(
            expect.objectContaining({
                verdict: "warn",
                network: { download_mbps: 12.22, upload_mbps: 0.4, latency_ms: 393 },
                checks: { browser: "passed", network: "warn", microphone: "passed", audio_output: "passed" },
            }),
        );
        await new Promise((r) => setTimeout(r, 50));
        expect(props.onReadiness).toHaveBeenCalledTimes(1);
    });
});
