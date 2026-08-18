import { describe, it, expect } from "vitest";
import {
  matchesQuery,
  sessionListStatus,
  collectAllPages,
} from "./listQuery";

describe("matchesQuery", () => {
  it("matches case-insensitive substrings", () => {
    expect(matchesQuery("Senior Backend", "back")).toBe(true);
    expect(matchesQuery("Ada Lovelace", "ADA")).toBe(true);
    expect(matchesQuery(null, "x")).toBe(false);
    expect(matchesQuery("Ada", "  ")).toBe(true);
  });
});

describe("sessionListStatus", () => {
  it("maps pending, live, completed, failed, and missing", () => {
    expect(sessionListStatus({ status: "pending" })).toBe("awaiting");
    expect(sessionListStatus({ status: "active" })).toBe("live");
    expect(sessionListStatus({ status: "ended", end_reason: "all_covered" })).toBe("completed");
    expect(sessionListStatus({ status: "ended", end_reason: "error" })).toBe("failed");
    expect(sessionListStatus(null)).toBe("none");
  });
});

describe("collectAllPages", () => {
  it("follows meta.total_pages instead of stopping at the first batch", async () => {
    const pages: Record<number, number[]> = { 1: [1, 2], 2: [3, 4], 3: [5] };
    const items = await collectAllPages(async (page) => ({
      items: pages[page] ?? [],
      totalPages: 3,
    }));
    expect(items).toEqual([1, 2, 3, 4, 5]);
  });

  it("requests the API max page size so the client is not capped at the default 20", async () => {
    const seen: number[] = [];
    await collectAllPages(async (_page, perPage) => {
      seen.push(perPage);
      return { items: [1], totalPages: 1 };
    });
    expect(seen).toEqual([100]);
  });
});
