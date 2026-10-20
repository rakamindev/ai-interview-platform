import { describe, expect, it } from "vitest";
import { FIT_GAP_RESULT_LABELS, isLevel, levelLabel } from "./constants";

describe("levelLabel", () => {
    it("labels levels 1 to 5", () => {
        expect(levelLabel(1)).toBe("L1");
        expect(levelLabel(5)).toBe("L5");
    });

    // The old parseLevel turned anything unreadable into L1.
    it.each([null, undefined, 0, 6, 2.5, Number.NaN])("never invents a level for %s", (value) => {
        expect(levelLabel(value)).toBe("Not assessed");
        expect(isLevel(value)).toBe(false);
    });
});

describe("FIT_GAP_RESULT_LABELS", () => {
    it("describes a missing measurement as missing evidence, not as a gap", () => {
        expect(FIT_GAP_RESULT_LABELS.not_assessed).toBe("No evidence");
        expect(FIT_GAP_RESULT_LABELS.gap).not.toBe(FIT_GAP_RESULT_LABELS.not_assessed);
    });
});
