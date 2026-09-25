import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useAudioCapture } from '@/hooks/useAudioCapture';
afterEach(() => vi.unstubAllGlobals());
it('propagates microphone refusal so the interview cannot silently start', async () => {
  const error = new Error('Permission denied');
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(error) } });
  const { result } = renderHook(() => useAudioCapture({ onFrame: vi.fn() }));
  await act(async () => { await expect(result.current.start()).rejects.toThrow('Permission denied'); });
  expect(result.current.isCapturing).toBe(false);
});
