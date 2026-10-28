import { describe, it, expect } from "vitest";
import { toLocalDateStr, toLocalTimeStr, buildMiniGrid, dKey } from "./calendarHelpers";

describe("calendarHelpers", () => {
  describe("toLocalDateStr", () => {
    it("formats standard ISO date string", () => {
      const result = toLocalDateStr("2026-10-28T14:30:00Z");
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe("dKey", () => {
    it("pads single-digit month and day with zero", () => {
      const d = new Date(2026, 0, 5); // Jan 5, 2026
      const result = dKey(d);
      expect(result).toBe("2026-01-05");
    });

    it("formats late month and day correctly", () => {
      const d = new Date(2026, 11, 31); // Dec 31, 2026
      const result = dKey(d);
      expect(result).toBe("2026-12-31");
    });
  });

  describe("buildMiniGrid", () => {
    it("always generates exactly 42 calendar grid cells (6 rows x 7 days)", () => {
      const grid = buildMiniGrid(2026, 9); // October 2026
      expect(grid).toHaveLength(42);
      grid.forEach((date) => expect(date instanceof Date).toBe(true));
    });

    it("starts on a Monday", () => {
      const grid = buildMiniGrid(2026, 9); // October 2026
      const firstCell = grid[0];
      // Day of week: 0 is Sun, 1 is Mon
      expect(firstCell.getDay()).toBe(1);
    });

    it("includes all days of the target month", () => {
      const year = 2026;
      const month = 1; // February 2026 (non-leap: 28 days)
      const grid = buildMiniGrid(year, month);
      const febDays = grid.filter((d) => d.getFullYear() === year && d.getMonth() === month);
      expect(febDays).toHaveLength(28);
    });
  });

  describe("toLocalTimeStr", () => {
    it("formats ISO string into a time string", () => {
      const result = toLocalTimeStr("2026-10-28T14:30:00Z");
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
