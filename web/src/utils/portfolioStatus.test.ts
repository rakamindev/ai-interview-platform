import { describe, it, expect } from "vitest";
import {
  normalizePortfolioResponse,
  portfolioActionsAllowed,
  sanitizeGenerationError,
} from "./portfolioStatus";
import type { Portfolio } from "@/types";

const basePortfolio = (status: Portfolio["generation_status"], error?: string): Portfolio => ({
  id: 1,
  session_id: 10,
  generation_status: status,
  generation_error: error,
  skills: [],
  overrides: [],
});

describe("sanitizeGenerationError", () => {
  it("redacts API-key-like tokens", () => {
    expect(
      sanitizeGenerationError("Gemini failed AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz123456 key")
    ).toContain("[redacted]");
  });

  it("redacts Bearer tokens", () => {
    expect(sanitizeGenerationError("Auth Bearer abc.def.ghi failed")).toContain("Bearer [redacted]");
  });

  it("returns null for blank", () => {
    expect(sanitizeGenerationError("  ")).toBeNull();
    expect(sanitizeGenerationError(null)).toBeNull();
  });
});

describe("normalizePortfolioResponse", () => {
  it("maps top-level generating and pending as generating", () => {
    expect(normalizePortfolioResponse({ status: "generating" })).toEqual({
      status: "generating",
      portfolio: null,
      errorMessage: null,
    });
    expect(normalizePortfolioResponse({ status: "pending" }).status).toBe("generating");
  });

  it("maps nested pending/generating portfolio rows as generating", () => {
    expect(normalizePortfolioResponse({ portfolio: basePortfolio("pending") }).status).toBe(
      "generating"
    );
    expect(normalizePortfolioResponse({ portfolio: basePortfolio("generating") }).status).toBe(
      "generating"
    );
  });

  it("maps failed portfolio and surfaces sanitized error", () => {
    const view = normalizePortfolioResponse({
      portfolio: basePortfolio("failed", "Model timeout"),
      error: "Model timeout",
    });
    expect(view.status).toBe("failed");
    expect(view.errorMessage).toBe("Model timeout");
  });

  it("falls back to generation_error then a safe retry copy", () => {
    expect(
      normalizePortfolioResponse({ portfolio: basePortfolio("failed", "Worker crashed") })
        .errorMessage
    ).toBe("Worker crashed");

    const blank = normalizePortfolioResponse({ portfolio: basePortfolio("failed", "  ") });
    expect(blank.status).toBe("failed");
    expect(blank.errorMessage).toMatch(/retry/i);
  });

  it("redacts secrets in failed error copy", () => {
    const view = normalizePortfolioResponse({
      portfolio: basePortfolio("failed"),
      error: "invalid key AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz123456",
    });
    expect(view.errorMessage).toContain("[redacted]");
    expect(view.errorMessage).not.toMatch(/AIza/);
  });

  it("maps complete portfolio", () => {
    const p = basePortfolio("complete");
    expect(normalizePortfolioResponse({ portfolio: p }).status).toBe("complete");
  });

  it("maps missing portfolio as empty", () => {
    const view = normalizePortfolioResponse({});
    expect(view.status).toBe("empty");
    expect(view.errorMessage).toMatch(/No portfolio/i);
  });
});

describe("portfolioActionsAllowed", () => {
  it("keeps export and fit-gap off until complete", () => {
    (["generating", "failed", "empty"] as const).forEach((status) => {
      expect(portfolioActionsAllowed(status, basePortfolio("complete"))).toEqual({
        canExport: false,
        canRunFitGap: false,
        canRetry: status === "failed",
      });
    });
  });

  it("allows export and fit-gap only when complete with a portfolio row", () => {
    expect(portfolioActionsAllowed("complete", null).canExport).toBe(false);
    expect(portfolioActionsAllowed("complete", basePortfolio("complete"))).toEqual({
      canExport: true,
      canRunFitGap: true,
      canRetry: false,
    });
  });
});
