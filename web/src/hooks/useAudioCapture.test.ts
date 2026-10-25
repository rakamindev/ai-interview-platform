import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAudioCapture } from './useAudioCapture';

describe('useAudioCapture Hook', () => {
    const mockOnFrame = vi.fn();
    const mockOnError = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();

        Object.defineProperty(global.navigator, 'mediaDevices', {
            value: {
                getUserMedia: vi.fn().mockResolvedValue({
                    getTracks: () => [{ stop: vi.fn() }]
                })
            },
            configurable: true
        });

        global.AudioContext = vi.fn().mockImplementation(function () {
            return {
                audioWorklet: { addModule: vi.fn().mockResolvedValue(true) },
                createMediaStreamSource: vi.fn().mockReturnValue({ connect: vi.fn() }),
                close: vi.fn(),
            };
        }) as any;

        global.AudioWorkletNode = vi.fn().mockImplementation(function () {
            return {
                port: { onmessage: null },
                disconnect: vi.fn(),
            };
        }) as any;
    });

    it('starts capturing audio streams successfully', async () => {
        const { result } = renderHook(() => useAudioCapture({ onFrame: mockOnFrame, onError: mockOnError }));

        expect(result.current.isCapturing).toBe(false);

        await act(async () => {
            await result.current.start();
        });

        expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
        expect(global.AudioContext).toHaveBeenCalled();
        expect(result.current.isCapturing).toBe(true);
    });

    it('handles microphone mute gates appropriately', async () => {
        const { result } = renderHook(() => useAudioCapture({ onFrame: mockOnFrame, onError: mockOnError }));

        await act(async () => {
            await result.current.start();
        });

        // Mute microphone
        act(() => {
            result.current.mute();
        });

        // Attempt to invoke the mock port onmessage event that the AudioWorklet triggers
        const workletNodeMock = (global.AudioWorkletNode as any).mock.results[0].value;
        act(() => {
            if (workletNodeMock.port.onmessage) {
                workletNodeMock.port.onmessage({ data: new ArrayBuffer(8) });
            }
        });

        // The handler should skip onFrame because of mute
        expect(mockOnFrame).not.toHaveBeenCalled();

        // Unmute
        act(() => {
            result.current.unmute();
        });

        // Fire again
        act(() => {
            if (workletNodeMock.port.onmessage) {
                workletNodeMock.port.onmessage({ data: new ArrayBuffer(8) });
            }
        });

        expect(mockOnFrame).toHaveBeenCalledTimes(1);
    });

    it('stops recording and clears resources correctly', async () => {
        const { result } = renderHook(() => useAudioCapture({ onFrame: mockOnFrame, onError: mockOnError }));

        await act(async () => {
            await result.current.start();
        });

        act(() => {
            result.current.stop();
        });

        expect(result.current.isCapturing).toBe(false);
    });
});
