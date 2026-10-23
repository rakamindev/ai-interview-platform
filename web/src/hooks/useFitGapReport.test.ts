import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_WAIT_MS, POLL_INTERVAL_MS, useFitGapReport } from "./useFitGapReport";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { portfolio, report } from "@/test/fixtures";

vi.mock("@/services/portfolios", () => ({
  portfoliosApi: { triggerFitGap: vi.fn(), getFitGap: vi.fn(), regenerateFitGap: vi.fn() },
}));
vi.mock("@/services/sessions", () => ({ sessionsApi: { getPortfolio: vi.fn() } }));

const api = vi.mocked(portfoliosApi);
const sessions = vi.mocked(sessionsApi);

const ok = <T,>(data: T) => Promise.resolve({ data } as never);
const notFound = () => Promise.reject({ response: { status: 404 } });
const networkError = () => Promise.reject(new Error("Network Error"));
const queued = () => ok({ status: "generating", message: "queued" });

async function flush() {
  await act(async () => {});
}
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("useFitGapReport", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessions.getPortfolio.mockImplementation(() => ok({ portfolio: portfolio() }));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a current report straight away without polling", async () => {
    api.triggerFitGap.mockImplementation(() => ok({ report: report() }));

    const { result } = renderHook(() => useFitGapReport(3, 9));
    await flush();

    expect(result.current.phase).toBe("ready");
    expect(result.current.report?.id).toBe(1);
    await advance(POLL_INTERVAL_MS * 3);
    expect(api.getFitGap).not.toHaveBeenCalled();
  });

  it("polls GET only (never re-queues) until the report is ready", async () => {
    api.triggerFitGap.mockImplementation(queued);
    api.getFitGap.mockImplementationOnce(notFound).mockImplementationOnce(notFound)
      .mockImplementation(() => ok({ report: report() }));

    const { result } = renderHook(() => useFitGapReport(3, 9));
    await flush();
    expect(result.current.phase).toBe("generating");

    await advance(POLL_INTERVAL_MS * 3);

    expect(result.current.phase).toBe("ready");
    expect(api.getFitGap).toHaveBeenCalledTimes(3);
    expect(api.triggerFitGap).toHaveBeenCalledTimes(1);
  });

  it("stops after the time limit instead of spinning forever, and can check again", async () => {
    api.triggerFitGap.mockImplementation(queued);
    api.getFitGap.mockImplementation(notFound);

    const { result } = renderHook(() => useFitGapReport(3, 9));
    await flush();
    await advance(MAX_WAIT_MS + POLL_INTERVAL_MS);

    expect(result.current.phase).toBe("slow");
    const calls = api.getFitGap.mock.calls.length;
    await advance(POLL_INTERVAL_MS * 5);
    expect(api.getFitGap).toHaveBeenCalledTimes(calls);

    api.triggerFitGap.mockImplementation(() => ok({ report: report() }));
    await act(async () => {
      result.current.retry();
    });
    expect(result.current.phase).toBe("ready");
  });

  it("reports an error after repeated network failures", async () => {
    api.triggerFitGap.mockImplementation(queued);
    api.getFitGap.mockImplementation(networkError);

    const { result } = renderHook(() => useFitGapReport(3, 9));
    await flush();
    await advance(POLL_INTERVAL_MS * 3);

    expect(result.current.phase).toBe("error");
  });

  it("does not ask for a report while the portfolio is not ready", async () => {
    sessions.getPortfolio.mockImplementation(() => ok({ status: "generating" }));

    const { result } = renderHook(() => useFitGapReport(3, 9));
    await flush();

    expect(result.current.phase).toBe("portfolio_not_ready");
    expect(api.triggerFitGap).not.toHaveBeenCalled();
  });

  it("keeps the previous report on screen while regenerating", async () => {
    api.triggerFitGap.mockImplementation(() => ok({ report: report({ overall_narrative: "Old." }) }));
    api.regenerateFitGap.mockImplementation(queued);
    api.getFitGap.mockImplementationOnce(notFound)
      .mockImplementation(() => ok({ report: report({ overall_narrative: "New." }) }));

    const { result } = renderHook(() => useFitGapReport(3, 9));
    await flush();
    await act(async () => {
      result.current.regenerate();
    });

    expect(result.current.updating).toBe(true);
    expect(result.current.report?.overall_narrative).toBe("Old.");

    await advance(POLL_INTERVAL_MS * 2);
    expect(result.current.updating).toBe(false);
    expect(result.current.report?.overall_narrative).toBe("New.");
  });

  it("ignores a slow response from a run that was replaced", async () => {
    let resolveSlow: (v: unknown) => void = () => {};
    api.triggerFitGap.mockImplementationOnce(queued)
      .mockImplementation(() => ok({ report: report({ overall_narrative: "Fresh." }) }));
    api.getFitGap.mockImplementationOnce(() => new Promise((r) => (resolveSlow = r)) as never);

    const { result } = renderHook(() => useFitGapReport(3, 9));
    await flush();
    await advance(POLL_INTERVAL_MS); // first poll is now in flight

    await act(async () => {
      result.current.retry();
    });
    expect(result.current.report?.overall_narrative).toBe("Fresh.");

    await act(async () => {
      resolveSlow({ data: { report: report({ overall_narrative: "Stale." }) } });
    });
    await flush(); // let the late response's continuation run before asserting
    expect(result.current.report?.overall_narrative).toBe("Fresh.");
  });

  it("stops polling when the page is left", async () => {
    api.triggerFitGap.mockImplementation(queued);
    api.getFitGap.mockImplementation(notFound);

    const { unmount } = renderHook(() => useFitGapReport(3, 9));
    await flush();
    unmount();
    await advance(POLL_INTERVAL_MS * 5);

    expect(api.getFitGap).not.toHaveBeenCalled();
  });
});
