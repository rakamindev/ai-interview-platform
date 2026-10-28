import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useFitGapReport } from "./useFitGapReport";
import { portfoliosApi } from "@/services/portfolios";
import contract from "../../../contracts/fit_gap_report.example.json";
import type { FitGapReport } from "@/types";

vi.mock("@/services/portfolios", () => ({
  portfoliosApi: { getFitGap: vi.fn(), triggerFitGap: vi.fn(), regenerateFitGap: vi.fn() },
}));

const api = vi.mocked(portfoliosApi);
const report = contract as FitGapReport;

const ok = (r: FitGapReport) => ({ status: 200, data: { report: r } });
const accepted = { status: 202, data: { status: "generating" } };
const httpError = (status: number, message?: string) =>
  Object.assign(new Error(`HTTP ${status}`), {
    response: { status, data: message ? { errors: [{ status, message }] } : {} },
  });

async function tick() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  // shouldAdvanceTime: Testing Library's waitFor only recognises Jest's fake timers.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  api.triggerFitGap.mockResolvedValue(accepted as never);
  api.regenerateFitGap.mockResolvedValue(accepted as never);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useFitGapReport (AC7.1, F7)", () => {
  it("starts generation once, then only polls until the report is ready", async () => {
    api.getFitGap
      .mockRejectedValueOnce(httpError(404))
      .mockResolvedValueOnce(accepted as never)
      .mockResolvedValueOnce(accepted as never)
      .mockResolvedValueOnce(ok(report) as never);

    const { result } = renderHook(() => useFitGapReport(4, 2));

    await waitFor(() => expect(result.current.phase).toBe("generating"));
    await tick();
    await tick();
    await tick();

    expect(result.current.phase).toBe("ready");
    expect(result.current.report?.id).toBe(report.id);
    expect(api.triggerFitGap).toHaveBeenCalledTimes(1);
  });

  it("does not start generation when another tab already did", async () => {
    api.getFitGap.mockResolvedValueOnce(accepted as never).mockResolvedValueOnce(ok(report) as never);

    const { result } = renderHook(() => useFitGapReport(4, 2));
    await waitFor(() => expect(result.current.phase).toBe("generating"));
    await tick();

    expect(result.current.phase).toBe("ready");
    expect(api.triggerFitGap).not.toHaveBeenCalled();
  });

  it("keeps showing the current report while a refresh runs", async () => {
    api.getFitGap
      .mockResolvedValueOnce(ok({ ...report, generating: true }) as never)
      .mockResolvedValueOnce(ok({ ...report, generating: false, overall_narrative: "New text." }) as never);

    const { result } = renderHook(() => useFitGapReport(4, 2));
    await waitFor(() => expect(result.current.phase).toBe("generating"));
    expect(result.current.report).not.toBeNull();

    await tick();
    expect(result.current.phase).toBe("ready");
    expect(result.current.report?.overall_narrative).toBe("New text.");
  });

  it("reports a run that ended without a report, and retries on request", async () => {
    api.getFitGap
      .mockRejectedValueOnce(httpError(404))
      .mockRejectedValueOnce(httpError(404))
      .mockRejectedValueOnce(httpError(404));

    const { result } = renderHook(() => useFitGapReport(4, 2));
    await waitFor(() => expect(result.current.phase).toBe("generating"));
    await tick();

    expect(result.current.phase).toBe("error");
    expect(result.current.error).toBe("The report could not be generated. Try again.");

    await act(async () => {
      result.current.retry();
    });
    expect(api.triggerFitGap).toHaveBeenCalledTimes(2);
  });

  it("shows the API's message when loading fails", async () => {
    api.getFitGap.mockRejectedValueOnce(httpError(500, "Something broke on our side."));

    const { result } = renderHook(() => useFitGapReport(4, 2));

    await waitFor(() => expect(result.current.phase).toBe("error"));
    expect(result.current.error).toBe("Something broke on our side.");
  });

  it("regenerates without hiding the current report", async () => {
    api.getFitGap.mockResolvedValue(ok(report) as never);

    const { result } = renderHook(() => useFitGapReport(4, 2));
    await waitFor(() => expect(result.current.phase).toBe("ready"));

    await act(async () => {
      await result.current.regenerate();
    });

    expect(api.regenerateFitGap).toHaveBeenCalledWith(4, 2);
    expect(result.current.phase).toBe("generating");
    expect(result.current.report?.id).toBe(report.id);
  });

  it("waits for the portfolio before asking for anything", () => {
    renderHook(() => useFitGapReport(null, 2));

    expect(api.getFitGap).not.toHaveBeenCalled();
  });
});
