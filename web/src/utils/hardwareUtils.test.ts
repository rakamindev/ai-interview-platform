import { describe, expect, it } from "vitest";
import {
  canStartInterviewAfterChecks,
  hasBlockingHardwareError,
  ProctoringState,
  type HardwareCheckingProgress,
} from "./hardwareUtils";

const passedChecks = (overrides: Partial<HardwareCheckingProgress> = {}): HardwareCheckingProgress => ({
  osAndBrowser: ProctoringState.PASSED,
  internet: ProctoringState.PASSED,
  camera: ProctoringState.PASSED,
  audio: ProctoringState.PASSED,
  microphone: ProctoringState.PASSED,
  ...overrides,
});

describe("hardware check start rules", () => {
  it("allows a candidate to continue after a completed but below-threshold internet check", () => {
    const progress = passedChecks({ internet: ProctoringState.ERROR });

    expect(canStartInterviewAfterChecks(progress, false)).toBe(true);
    expect(hasBlockingHardwareError(progress, false)).toBe(false);
  });

  it("continues to block when a required microphone, audio, or camera check fails", () => {
    expect(canStartInterviewAfterChecks(passedChecks({ microphone: ProctoringState.ERROR }), false)).toBe(false);
    expect(hasBlockingHardwareError(passedChecks({ microphone: ProctoringState.ERROR }), false)).toBe(true);
    expect(canStartInterviewAfterChecks(passedChecks({ camera: ProctoringState.ERROR }), true)).toBe(false);
  });

  it("waits for the internet check to finish before offering the continue-anyway decision", () => {
    expect(canStartInterviewAfterChecks(passedChecks({ internet: ProctoringState.LOADING }), false)).toBe(false);
  });
});
