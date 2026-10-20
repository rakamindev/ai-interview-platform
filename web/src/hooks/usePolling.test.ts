import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePolling } from "@/hooks/usePolling";

/**
 * Advances `ms` in slices so each asynchronous tick settles before the next one
 * fires — a single synchronous burst would trip the hook's in-flight guard.
 */
async function advance(ms: number, step = 250) {
    for (let elapsed = 0; elapsed < ms; elapsed += step) {
        await act(async () => {
            vi.advanceTimersByTime(Math.min(step, ms - elapsed));
        });
    }
}

describe("usePolling", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("does not poll while inactive and starts on the next tick once active", async () => {
        const fn = vi.fn();
        const { rerender } = renderHook(({ active }: { active: boolean }) => usePolling(fn, 1000, active), {
            initialProps: { active: false },
        });

        await advance(5000);
        expect(fn).not.toHaveBeenCalled();

        rerender({ active: true });
        await advance(1000);
        expect(fn).toHaveBeenCalledTimes(1);

        await advance(2000);
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it("stops polling while inactive and resumes when active again", async () => {
        const fn = vi.fn();
        const { rerender } = renderHook(({ active }: { active: boolean }) => usePolling(fn, 1000, active), {
            initialProps: { active: true },
        });

        await advance(2000);
        expect(fn).toHaveBeenCalledTimes(2);

        rerender({ active: false });
        await advance(5000);
        expect(fn).toHaveBeenCalledTimes(2);

        rerender({ active: true });
        await advance(1000);
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it("skips a tick while the previous request is still running", async () => {
        let release!: () => void;
        const pending = new Promise<void>((resolve) => {
            release = resolve;
        });
        const fn = vi.fn(() => pending);

        renderHook(() => usePolling(fn, 1000, true));

        await advance(1000);
        expect(fn).toHaveBeenCalledTimes(1);

        // Three ticks elapse while the first request is still in flight.
        await advance(3000);
        expect(fn).toHaveBeenCalledTimes(1);

        release();
        await act(async () => {});

        await advance(1000);
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it("polls through the latest callback without restarting the interval", async () => {
        const first = vi.fn();
        const second = vi.fn();
        const { rerender } = renderHook(({ fn }: { fn: () => void }) => usePolling(fn, 1000, true), {
            initialProps: { fn: first },
        });

        await advance(1000);
        expect(first).toHaveBeenCalledTimes(1);

        await advance(400);
        rerender({ fn: second });

        await advance(600);
        expect(second).toHaveBeenCalledTimes(1);
        expect(first).toHaveBeenCalledTimes(1);
    });

    it("restarts on the new interval when the interval changes", async () => {
        const fn = vi.fn();
        const { rerender } = renderHook(({ ms }: { ms: number }) => usePolling(fn, ms, true), {
            initialProps: { ms: 1000 },
        });

        await advance(1000);
        expect(fn).toHaveBeenCalledTimes(1);

        rerender({ ms: 5000 });
        await advance(1000);
        expect(fn).toHaveBeenCalledTimes(1);

        await advance(4000);
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it("stops polling when the component unmounts", async () => {
        const fn = vi.fn();
        const { unmount } = renderHook(() => usePolling(fn, 1000, true));

        await advance(2000);
        expect(fn).toHaveBeenCalledTimes(2);

        unmount();
        await advance(5000);
        expect(fn).toHaveBeenCalledTimes(2);
    });
});
