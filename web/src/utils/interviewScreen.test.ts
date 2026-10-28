import { describe, it, expect } from "vitest";
import {
	screenForReason,
	screenForSession,
} from "./interviewScreen";

describe("screenForSession (page load)", () => {
	const cases: [
		string,
		string | null | undefined,
		"complete" | "error" | null,
	][] = [
		// AC-01
		["ended", "error", "error"],
		// AC-02
		["ended", "manual_candidate", "complete"],
		["ended", "manual_assessor", "complete"],
		["ended", "all_covered", "complete"],
		["ended", "time_ceiling", "complete"],
		["ended", null, "complete"],
		["ended", undefined, "complete"],
		// AC-03
		["failed", null, "error"],
		["ended", "some_new_reason", "error"],
		// AC-04
		["pending", null, null],
		["active", null, null],
	];

	it.each(cases)(
		"status %s with reason %s gives %s",
		(status, reason, expected) => {
			expect(screenForSession(status, reason)).toBe(expected);
		},
	);
});

describe("screenForReason (WebSocket session_ended)", () => {
	it("shows error when the session ended with an error", () => {
		expect(screenForReason("error")).toBe("error");
	});

	it("shows complete for a normal ending", () => {
		expect(screenForReason("all_covered")).toBe("complete");
	});

	it("shows error for an unknown reason", () => {
		expect(screenForReason("unexpected")).toBe("error");
	});
});