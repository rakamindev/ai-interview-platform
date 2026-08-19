import { describe, it, expect, vi, beforeEach } from "vitest";

// jsdom@30 does not provide localStorage — mock before any import triggers authAtom
vi.hoisted(() => {
  const store = new Map<string, string>();
  const localStorageMock = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
    get length() {
      return store.size;
    },
    key: (i: number) => [...store.keys()][i] ?? null
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: localStorageMock,
    configurable: true
  });
});

// Mock the api module so we can control the response
vi.mock("./api", () => ({
  api: {
    get: vi.fn()
  },
  parseResponse: vi.fn((_data: unknown, _schema: unknown, fallback: unknown) => fallback)
}));

import { api } from "./api";
import { portfoliosApi } from "./portfolios";

describe("portfoliosApi.exportPortfolio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when a PDF blob response is actually a JSON error body", async () => {
    const jsonError = { message: "Portfolio not found" };
    const blob = new Blob([JSON.stringify(jsonError)], { type: "application/json" });

    vi.mocked(api.get).mockResolvedValue({
      data: blob,
      headers: { "content-type": "application/json" }
    });

    await expect(portfoliosApi.exportPortfolio(1, "pdf")).rejects.toThrow("Portfolio not found");
  });

  it("throws a generic message when the JSON error body is not parseable", async () => {
    const blob = new Blob(["not json"], { type: "text/html" });

    vi.mocked(api.get).mockResolvedValue({
      data: blob,
      headers: { "content-type": "text/html" }
    });

    await expect(portfoliosApi.exportPortfolio(1, "pdf")).rejects.toThrow(
      "Export failed with an unexpected response"
    );
  });

  it("returns the response normally when the blob is a real PDF", async () => {
    const blob = new Blob(["%PDF-1.4 fake"], { type: "application/pdf" });

    vi.mocked(api.get).mockResolvedValue({
      data: blob,
      headers: { "content-type": "application/pdf" }
    });

    const result = await portfoliosApi.exportPortfolio(1, "pdf");
    expect(result.data).toBe(blob);
  });

  it("returns JSON responses without blob checking", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { some: "json" },
      headers: { "content-type": "application/json" }
    });

    const result = await portfoliosApi.exportPortfolio(1, "json");
    expect(result.data).toEqual({ some: "json" });
  });
});
