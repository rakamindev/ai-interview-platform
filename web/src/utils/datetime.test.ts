import { describe, expect, it } from "vitest";
import { formatDate, formatUtc } from "@/utils/datetime";

describe("formatUtc", () => {
    it("formats a timestamp in UTC with the time", () => {
        expect(formatUtc("2026-10-25T08:00:00Z")).toBe("25 Oct 2026, 08:00 UTC");
    });

    it.each([null, undefined, "", "bukan tanggal"])("says the time was not recorded for %s", (value) => {
        expect(formatUtc(value)).toBe("time not recorded");
    });
});

// One date format across lists, instead of the browser's own (10/26/2026).
describe("formatDate", () => {
    it("formats the UTC calendar date without the time", () => {
        expect(formatDate("2026-10-25T08:00:00Z")).toBe("25 Oct 2026");
    });

    it("uses the UTC day, not the local day, near midnight", () => {
        expect(formatDate("2026-10-25T23:30:00Z")).toBe("25 Oct 2026");
    });

    it.each([null, undefined, "", "bukan tanggal"])("says the date was not recorded for %s", (value) => {
        expect(formatDate(value)).toBe("date not recorded");
    });
});
