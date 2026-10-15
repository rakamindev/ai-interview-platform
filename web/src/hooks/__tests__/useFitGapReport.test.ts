import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { FITGAP_POLL_MS, FITGAP_TIMEOUT_MS, useFitGapReport } from "../useFitGapReport";
import { portfoliosApi } from "@/services/portfolios";
import type { FitGapReport } from "@/types";

vi.mock("@/services/portfolios", () => ({ portfoliosApi: {} }));

// Plain stubs rather than vi.fn(): vitest 3.2 reports rejected vi.fn() results
// as test failures even when the hook handles them.
const api = portfoliosApi as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>;

const notFound = () => Promise.reject(Object.assign(new Error("404"), { response: { status: 404 } }));
const report = { id: 1, skill_comparisons: [] } as unknown as FitGapReport;

let calls: Record<string, number>;
function counted(name: string, impl: () => Promise<unknown>) {
  api[name] = () => {
    calls[name] = (calls[name] ?? 0) + 1;
    return impl();
  };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("useFitGapReport", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    calls = {};
  });

  afterEach(() => vi.useRealTimers());

  it("returns an existing report without starting a job", async () => {
    counted("getFitGap", () => Promise.resolve({ data: { report } }));
    counted("triggerFitGap", () => Promise.resolve({ data: { status: "generating" } }));

    const { result } = renderHook(() => useFitGapReport(7, 3));
    await flush();

    expect(result.current.state).toEqual({ status: "ready", report });
    expect(calls.triggerFitGap).toBeUndefined();
  });

  it("starts generation once and keeps polling with GET only", async () => {
    let ready = false;
    counted("getFitGap", () => (ready ? Promise.resolve({ data: { report } }) : notFound()));
    counted("triggerFitGap", () => Promise.resolve({ data: { status: "generating" } }));

    const { result } = renderHook(() => useFitGapReport(7, 3));
    await flush();
    expect(result.current.state.status).toBe("generating");

    for (let i = 0; i < 5; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(FITGAP_POLL_MS);
      });
    }
    expect(calls.triggerFitGap).toBe(1);

    ready = true;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FITGAP_POLL_MS);
    });
    expect(result.current.state).toEqual({ status: "ready", report });
  });

  it("stops polling and reports a timeout when the job never finishes", async () => {
    counted("getFitGap", notFound);
    counted("triggerFitGap", () => Promise.resolve({ data: { status: "generating" } }));

    const { result } = renderHook(() => useFitGapReport(7, 3));
    await flush();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(FITGAP_TIMEOUT_MS + FITGAP_POLL_MS * 2);
    });
    expect(result.current.state.status).toBe("timeout");

    const pollsAtTimeout = calls.getFitGap;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FITGAP_POLL_MS * 5);
    });
    expect(calls.getFitGap).toBe(pollsAtTimeout);
  });

  it("shows the server message when loading fails for another reason", async () => {
    api.getFitGap = () =>
      Promise.reject({ response: { status: 500, data: { errors: [{ message: "Database unavailable" }] } } });

    const { result } = renderHook(() => useFitGapReport(7, 3));
    await flush();

    expect(result.current.state).toEqual({ status: "error", message: "Database unavailable" });
  });

  it("waits until the portfolio is known", async () => {
    counted("getFitGap", notFound);

    renderHook(() => useFitGapReport(null, 3));
    await flush();

    expect(calls.getFitGap).toBeUndefined();
  });
});
