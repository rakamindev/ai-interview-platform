import { describe, expect, it } from "vitest";
import {
  SLOW_AFTER_MS,
  canRetry,
  derivePortfolioState,
  isInProgress,
  retryErrorMessage,
  waitedMs,
  type PortfolioResponseBody,
} from "./portfolioState";

const NOW = Date.parse("2026-10-24T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const generating = (changedMsAgo?: number): PortfolioResponseBody => ({
  status: "generating",
  portfolio: {
    generation_status: "pending",
    ...(changedMsAgo === undefined ? {} : { status_changed_at: ago(changedMsAgo) }),
  },
});

describe("waitedMs", () => {
  it("is 0 when the API gives no timestamp", () => {
    expect(waitedMs(generating(), NOW)).toBe(0);
  });

  it("is 0 for an unparseable timestamp", () => {
    expect(waitedMs({ portfolio: { status_changed_at: "not-a-date" } }, NOW)).toBe(0);
  });

  it("never goes negative when the server clock is ahead", () => {
    expect(waitedMs({ portfolio: { status_changed_at: ago(-5_000) } }, NOW)).toBe(0);
  });

  it("measures the time since the last status change", () => {
    expect(waitedMs(generating(90_000), NOW)).toBe(90_000);
  });
});

describe("derivePortfolioState", () => {
  it("is complete when the portfolio is complete", () => {
    expect(derivePortfolioState({ portfolio: { generation_status: "complete" } }, NOW)).toEqual({ kind: "complete" });
  });

  it("is failed and keeps the reason from the portfolio", () => {
    const body: PortfolioResponseBody = {
      portfolio: { generation_status: "failed", generation_error: "enqueue_failed: queue unavailable" },
    };
    expect(derivePortfolioState(body, NOW)).toEqual({ kind: "failed", reason: "enqueue_failed: queue unavailable" });
  });

  it("is failed without a reason when none is given", () => {
    expect(derivePortfolioState({ portfolio: { generation_status: "failed" } }, NOW)).toEqual({
      kind: "failed",
      reason: undefined,
    });
  });

  it("is generating when there is no portfolio row yet", () => {
    expect(derivePortfolioState({ status: "generating" }, NOW)).toEqual({ kind: "generating" });
  });

  it("is generating shortly after the status changed", () => {
    expect(derivePortfolioState(generating(30_000), NOW)).toEqual({ kind: "generating" });
  });

  it("is slow once the usual wait has passed", () => {
    expect(derivePortfolioState(generating(SLOW_AFTER_MS), NOW)).toEqual({ kind: "slow" });
  });

  it("is stale when the API says the job was lost (status)", () => {
    expect(derivePortfolioState({ status: "stale", portfolio: { generation_status: "pending" } }, NOW)).toEqual({
      kind: "stale",
    });
  });

  it("is stale when the API flags it, even without a status string", () => {
    expect(derivePortfolioState({ stale: true, portfolio: { generation_status: "pending" } }, NOW)).toEqual({
      kind: "stale",
    });
  });

  it("prefers failed over stale", () => {
    const body: PortfolioResponseBody = { stale: true, portfolio: { generation_status: "failed" } };
    expect(derivePortfolioState(body, NOW).kind).toBe("failed");
  });
});

describe("isInProgress and canRetry", () => {
  it("keeps polling only while a job may still finish", () => {
    expect(isInProgress({ kind: "generating" })).toBe(true);
    expect(isInProgress({ kind: "slow" })).toBe(true);
    expect(isInProgress({ kind: "stale" })).toBe(false);
    expect(isInProgress({ kind: "failed" })).toBe(false);
    expect(isInProgress({ kind: "complete" })).toBe(false);
    expect(isInProgress({ kind: "unreachable" })).toBe(false);
  });

  it("offers a retry only for failed or stale portfolios", () => {
    expect(canRetry({ kind: "failed" })).toBe(true);
    expect(canRetry({ kind: "stale" })).toBe(true);
    expect(canRetry({ kind: "generating" })).toBe(false);
    expect(canRetry({ kind: "slow" })).toBe(false);
    expect(canRetry({ kind: "complete" })).toBe(false);
    expect(canRetry({ kind: "unreachable" })).toBe(false);
  });
});

describe("retryErrorMessage", () => {
  it("explains a refused retry (409)", () => {
    expect(retryErrorMessage(409)).toMatch(/already being generated/);
  });

  it("explains an unavailable queue (503)", () => {
    expect(retryErrorMessage(503)).toMatch(/queue is unavailable/);
  });

  it("falls back to a generic message for anything else", () => {
    expect(retryErrorMessage(500)).toMatch(/Could not restart/);
    expect(retryErrorMessage(undefined)).toMatch(/Could not restart/);
  });

  it("never exposes infrastructure details", () => {
    for (const status of [409, 503, 500, undefined]) {
      expect(retryErrorMessage(status)).not.toMatch(/redis|localhost|sidekiq/i);
    }
  });
});
