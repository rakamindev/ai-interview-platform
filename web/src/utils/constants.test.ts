import { describe, expect, it } from "vitest";

import { parseLevel } from "./constants";

describe("parseLevel", () => {
    it("passes numbers through", () => {
        expect(parseLevel(4)).toBe(4);
    });

    it("parses L-prefixed levels", () => {
        expect(parseLevel("L3")).toBe(3);
    });

    it("falls back to 1 for unparseable input", () => {
        expect(parseLevel("unknown")).toBe(1);
    });
});
