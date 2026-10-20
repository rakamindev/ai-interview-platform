import { describe, it, expect } from "vitest";
import { parseIsoDate, formatDateTime, formatDate, formatTime } from "../dateTime";

describe("dateTime utility (TIME-02)", () => {
  describe("parseIsoDate", () => {
    it("returns null for null, undefined, and empty string", () => {
      expect(parseIsoDate(null)).toBeNull();
      expect(parseIsoDate(undefined)).toBeNull();
      expect(parseIsoDate("")).toBeNull();
    });

    it("parses zoned ISO string correctly", () => {
      const d = parseIsoDate("2026-10-17T03:30:00Z");
      expect(d).not.toBeNull();
      expect(d?.toISOString()).toBe("2026-10-17T03:30:00.000Z");
    });

    it("interprets unzoned SQL datetime string as UTC to prevent local drift", () => {
      const d = parseIsoDate("2026-10-17 03:30:00");
      expect(d).not.toBeNull();
      expect(d?.toISOString()).toBe("2026-10-17T03:30:00.000Z");
    });

    it("interprets unzoned ISO string as UTC", () => {
      const d = parseIsoDate("2026-10-17T03:30:00");
      expect(d).not.toBeNull();
      expect(d?.toISOString()).toBe("2026-10-17T03:30:00.000Z");
    });
  });

  describe("formatDateTime, formatDate, formatTime", () => {
    const testDate = "2026-10-17T14:45:30Z";

    it("formats both date and time", () => {
      const formatted = formatDateTime(testDate, "en-US");
      expect(formatted).toMatch(/2026/);
      expect(formatted).toMatch(/45/);
    });

    it("formats date only", () => {
      const formatted = formatDate(testDate, "en-US");
      expect(formatted).toMatch(/2026/);
    });

    it("formats time only", () => {
      const formatted = formatTime(testDate, "en-US", true);
      expect(formatted).toMatch(/45/);
    });

    it("returns placeholder dash for invalid date input", () => {
      expect(formatDateTime(null)).toBe("—");
      expect(formatDate(null)).toBe("—");
      expect(formatTime(null)).toBe("—");
    });
  });
});
