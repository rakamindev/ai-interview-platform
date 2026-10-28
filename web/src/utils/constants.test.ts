import { describe, expect, it } from "vitest";
import { parseLevel } from "@/utils/constants";

// AC-03/AC-04 on the web side: an unknown level must stay unknown, never L1.
describe("parseLevel", () => {
    it.each([
        [3, 3],
        ["L3", 3],
        ["4", 4],
    ])("parses %j as %i", (input, expected) => {
        expect(parseLevel(input)).toBe(expected);
    });

    it.each([null, undefined, "tiga", "", 0, 6, 7, "L9", 2.5])("returns null for %j", (input) => {
        expect(parseLevel(input)).toBeNull();
    });
});
