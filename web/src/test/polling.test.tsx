import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { usePolling } from '@/hooks/usePolling';
afterEach(() => vi.useRealTimers());
it('does not overlap slow requests and stops after unmount', async () => {
  vi.useFakeTimers();
  let resolve!: () => void;
  const poll = vi.fn(() => new Promise<void>(r => { resolve = r; }));
  const { unmount } = renderHook(() => usePolling(poll, 100, true));
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(poll).toHaveBeenCalledTimes(1);
  await act(async () => { resolve(); });
  await act(async () => { await vi.advanceTimersByTimeAsync(100); });
  expect(poll).toHaveBeenCalledTimes(2);
  unmount();
  await act(async () => { resolve(); await vi.advanceTimersByTimeAsync(1000); });
  expect(poll).toHaveBeenCalledTimes(2);
});
