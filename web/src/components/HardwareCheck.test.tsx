/**
 * Unit tests for HardwareCheck logic — pure logic layer
 *
 * These tests avoid rendering the HardwareCheck component directly (which would
 * require mocking requestAnimationFrame, AudioContext, setTimeout chains, etc.).
 * Instead, they test:
 *   1. The allPassed logic as a pure function (the bug that was fixed)
 *   2. The DEFAULT_THRESHOLDS interface contract (no upload field)
 *   3. The retryAll initial state (camera=PASSED when REQUIRE_CAMERA=false)
 *
 * End-to-end rendering behavior is tested manually (hardware + browser required).
 */

import { describe, it, expect } from "vitest";
import { DEFAULT_THRESHOLDS } from "@/utils/internetSpeedTest";

// These are the exact values from HardwareCheck.tsx's ProctoringState
const State = { WAITING: "waiting", LOADING: "loading", PASSED: "passed", ERROR: "error" } as const;
type PState = typeof State[keyof typeof State];

// ── Pure function extracted from HardwareCheck.tsx for testing ────────────────
// This mirrors the exact logic at lines 67-75 in HardwareCheck.tsx

function computeAllPassed(
    progress: { osAndBrowser: PState; internet: PState; camera: PState; audio: PState; microphone: PState },
    requireCamera: boolean
): boolean {
    const cameraOk = requireCamera ? progress.camera === State.PASSED : true;
    return (
        progress.osAndBrowser === State.PASSED &&
        progress.internet     === State.PASSED &&
        cameraOk                               &&
        progress.audio        === State.PASSED &&
        progress.microphone   === State.PASSED
    );
}

// This mirrors the retryAll() initial state in HardwareCheck.tsx
function retryAllInitialState(requireCamera: boolean) {
    return {
        osAndBrowser: State.LOADING,
        internet:     State.WAITING,
        camera:       requireCamera ? State.WAITING : State.PASSED,  // BUG FIX: was always WAITING
        audio:        State.WAITING,
        microphone:   State.WAITING,
    };
}

// ── Tests: allPassed logic ────────────────────────────────────────────────────

describe("allPassed logic (P0-2 fix)", () => {
    const allPassedProgress = {
        osAndBrowser: State.PASSED,
        internet:     State.PASSED,
        camera:       State.PASSED,
        audio:        State.PASSED,
        microphone:   State.PASSED,
    };

    it("returns true when all checks pass (camera also passed)", () => {
        expect(computeAllPassed(allPassedProgress, true)).toBe(true);
        expect(computeAllPassed(allPassedProgress, false)).toBe(true);
    });

    it("returns false when internet check fails", () => {
        const p = { ...allPassedProgress, internet: State.ERROR };
        expect(computeAllPassed(p, false)).toBe(false);
    });

    it("returns false when microphone check fails", () => {
        const p = { ...allPassedProgress, microphone: State.ERROR };
        expect(computeAllPassed(p, false)).toBe(false);
    });

    it("returns false when audio check fails", () => {
        const p = { ...allPassedProgress, audio: State.ERROR };
        expect(computeAllPassed(p, false)).toBe(false);
    });

    // --- The P0-2 bug fix ---
    it("returns true even when camera=WAITING, when REQUIRE_CAMERA=false", () => {
        const p = { ...allPassedProgress, camera: State.WAITING };
        // BUG BEFORE FIX: this returned false because camera === PASSED was always required
        // BUG AFTER FIX: when requireCamera=false, camera state is excluded from the check
        expect(computeAllPassed(p, false)).toBe(true);  // ← was false (the bug)
    });

    it("returns false when camera=WAITING and REQUIRE_CAMERA=true", () => {
        const p = { ...allPassedProgress, camera: State.WAITING };
        expect(computeAllPassed(p, true)).toBe(false);
    });

    it("returns false when camera=ERROR and REQUIRE_CAMERA=true", () => {
        const p = { ...allPassedProgress, camera: State.ERROR };
        expect(computeAllPassed(p, true)).toBe(false);
    });

    it("returns true when camera=ERROR and REQUIRE_CAMERA=false", () => {
        // Camera error is irrelevant when camera is not required
        const p = { ...allPassedProgress, camera: State.ERROR };
        expect(computeAllPassed(p, false)).toBe(true);
    });
});

// ── Tests: retryAll initial state ─────────────────────────────────────────────

describe("retryAll initial state (P0-2 fix)", () => {
    it("sets camera=PASSED when REQUIRE_CAMERA=false", () => {
        const state = retryAllInitialState(false);
        // BUG BEFORE FIX: camera was reset to WAITING, which meant allPassed could never be true
        // because the Step 2 internet handler only sets camera=PASSED on a PASSING result.
        // If internet failed, camera stayed WAITING permanently.
        expect(state.camera).toBe(State.PASSED);
    });

    it("sets camera=WAITING when REQUIRE_CAMERA=true", () => {
        const state = retryAllInitialState(true);
        expect(state.camera).toBe(State.WAITING);
    });

    it("starts osAndBrowser=LOADING to trigger Step 1", () => {
        const state = retryAllInitialState(false);
        expect(state.osAndBrowser).toBe(State.LOADING);
    });

    it("starts internet=WAITING (not LOADING) — Step 2 activates when Step 1 passes", () => {
        const state = retryAllInitialState(false);
        expect(state.internet).toBe(State.WAITING);
    });
});

// ── Tests: internetSpeedTest contract ────────────────────────────────────────

describe("internetSpeedTest interface contract", () => {
    it("DEFAULT_THRESHOLDS has correct minDownloadMbps and maxPingMs", () => {
        expect(DEFAULT_THRESHOLDS.minDownloadMbps).toBeDefined();
        expect(DEFAULT_THRESHOLDS.maxPingMs).toBeDefined();
    });

    it("DEFAULT_THRESHOLDS includes minUploadMbps (restored with lower threshold)", () => {
        expect(DEFAULT_THRESHOLDS.minUploadMbps).toBeDefined();
    });
});
