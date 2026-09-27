import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import HardwareCheck from "@/components/HardwareCheck";
import * as internetSpeedTestModule from "@/utils/internetSpeedTest";
import * as hardwareUtilsModule from "@/utils/hardwareUtils";

describe("HardwareCheck (Advisory Connectivity & Clean Teardown)", () => {
    let mockTrackStop: ReturnType<typeof vi.fn>;
    let mockStream: any;
    let mockAudioContextClose: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.restoreAllMocks();
        mockTrackStop = vi.fn();
        mockStream = {
            getTracks: vi.fn(() => [{ stop: mockTrackStop }]),
        };
        mockAudioContextClose = vi.fn().mockResolvedValue(undefined);

        vi.spyOn(hardwareUtilsModule, "getBrowserInfo").mockReturnValue({ browser: "Chrome", version: "120" });
        vi.spyOn(hardwareUtilsModule, "getOSInfo").mockReturnValue("macOS");
        vi.spyOn(hardwareUtilsModule, "getCurrentTime").mockReturnValue("12:00 PM");

        // Mock getUserMedia
        Object.defineProperty(navigator, "mediaDevices", {
            writable: true,
            value: {
                getUserMedia: vi.fn().mockResolvedValue(mockStream),
            },
        });

        // Mock AudioContext
        class MockAudioContext {
            state = "running";
            currentTime = 0;
            destination = {};
            createOscillator() {
                return {
                    connect: vi.fn(),
                    start: vi.fn(),
                    stop: vi.fn(),
                    frequency: { setValueAtTime: vi.fn() },
                };
            }
            createGain() {
                return {
                    connect: vi.fn(),
                    gain: { setValueAtTime: vi.fn() },
                };
            }
            createMediaStreamSource() {
                return { connect: vi.fn() };
            }
            createAnalyser() {
                return {
                    fftSize: 256,
                    frequencyBinCount: 128,
                    getByteFrequencyData: vi.fn(),
                };
            }
            resume = vi.fn().mockResolvedValue(undefined);
            close = mockAudioContextClose;
        }

        (window as any).AudioContext = MockAudioContext;
    });

    it("supports soft bypass when internet speed test reports advisory warning", async () => {
        vi.spyOn(internetSpeedTestModule, "testInternetSpeed").mockResolvedValue({
            download: 0.8,
            upload: 0.3,
            ping: 350,
            jitter: 80,
            passed: false,
            isAdvisory: true,
            downloadTests: [0.8],
            uploadTests: [0.3],
            pingTests: [350],
        });

        const onStart = vi.fn();
        render(<HardwareCheck onStart={onStart} />);

        // Wait for checks to complete
        await waitFor(() => {
            expect(screen.getByRole("button", { name: /Proceed anyway|Lanjutkan/i })).toBeInTheDocument();
        });

        // Start Interview button should be disabled before soft bypass
        const startBtn = screen.getByRole("button", { name: /Start Interview/i });
        expect(startBtn).toBeDisabled();

        // Click "Proceed anyway" to trigger soft bypass
        const proceedAnywayBtn = screen.getByRole("button", { name: /Proceed anyway|Lanjutkan/i });
        fireEvent.click(proceedAnywayBtn);

        // Now Start Interview is enabled
        await waitFor(() => {
            expect(startBtn).toBeEnabled();
        });

        // Clicking Start Interview triggers clean track stop and calls onStart
        fireEvent.click(startBtn);
        expect(onStart).toHaveBeenCalledTimes(1);
        expect(mockTrackStop).toHaveBeenCalled();
    });
});
