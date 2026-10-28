import { describe, expect, it } from "vitest";
import { candidateReviewStatus, reasonText, waitingText } from "@/components/review/reviewText";

describe("reasonText", () => {
    it.each([
        [{ code: "unreviewed_low_confidence", count: 1 }, "1 low confidence skill"],
        [{ code: "unreviewed_low_confidence", count: 3 }, "3 low confidence skills"],
        [{ code: "unreviewed_not_assessed", count: 2 }, "2 skills not assessed"],
        [{ code: "narrative_failed", count: 1 }, "Narrative failed"],
        [{ code: "narrative_outdated", count: 2 }, "2 narratives outdated"],
        [{ code: "legacy_ratings", count: 1 }, "Legacy ratings"],
        [{ code: "generation_failed", count: 1 }, "Portfolio generation failed"],
        [{ code: "empty_portfolio", count: 1 }, "No skills in portfolio"],
    ] as const)("describes %o as %s", (reason, text) => {
        expect(reasonText(reason)).toBe(text);
    });
});

describe("waitingText", () => {
    const now = new Date("2026-10-26T12:00:00Z");

    it.each([
        ["2026-10-26T11:30:00Z", "waiting less than an hour"],
        ["2026-10-26T11:00:00Z", "waiting 1 hour"],
        ["2026-10-26T07:00:00Z", "waiting 5 hours"],
        ["2026-10-25T11:00:00Z", "waiting 1 day"],
        ["2026-10-24T08:00:00Z", "waiting 2 days"],
    ])("reads %s as %s", (since, text) => {
        expect(waitingText(since, now)).toBe(text);
    });

    it("does not invent a time for a missing date", () => {
        expect(waitingText("bukan tanggal", now)).toBe("waiting time unknown");
    });
});

// One honest line per reason group for a candidate row; never "Completed".
describe("candidateReviewStatus", () => {
    it("adds up both kinds of unreviewed skills", () => {
        expect(candidateReviewStatus([
            { code: "unreviewed_low_confidence", count: 2 },
            { code: "unreviewed_not_assessed", count: 1 },
        ])).toEqual([{ text: "3 skills need review", tone: "warning" }]);
    });

    it("lists the narrative and legacy reasons next to the skills", () => {
        expect(candidateReviewStatus([
            { code: "unreviewed_low_confidence", count: 1 },
            { code: "narrative_outdated", count: 1 },
            { code: "legacy_ratings", count: 1 },
        ])).toEqual([
            { text: "1 skill needs review", tone: "warning" },
            { text: "Narrative outdated", tone: "warning" },
            { text: "Legacy ratings", tone: "warning" },
        ]);
    });

    it("says so when a portfolio has no skills at all", () => {
        expect(candidateReviewStatus([{ code: "empty_portfolio", count: 1 }]))
            .toEqual([{ text: "No skills in portfolio", tone: "warning" }]);
    });

    it("says Reviewed when nothing is left", () => {
        expect(candidateReviewStatus([])).toEqual([{ text: "Reviewed", tone: "success" }]);
    });
});
