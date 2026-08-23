import { describe, it, expect } from "vitest";
import { formatDate, formatDateTime } from "./utils";

describe("formatDate", () => {
  it("formats an ISO date as 'D MMM YYYY'", () => {
    expect(formatDate("2026-08-23T10:00:00Z")).toBe("23 Aug 2026");
  });

  it("returns null for a nullish input", () => {
    expect(formatDate(undefined)).toBeNull();
    expect(formatDate(null)).toBeNull();
  });
});

describe("formatDateTime", () => {
  it("formats an ISO date as 'D MMM YYYY, HH:mm'", () => {
    expect(formatDateTime("2026-08-23T14:05:00Z")).toBe("23 Aug 2026, 14:05");
  });

  it("returns null for a nullish input", () => {
    expect(formatDateTime(undefined)).toBeNull();
    expect(formatDateTime(null)).toBeNull();
  });
});
