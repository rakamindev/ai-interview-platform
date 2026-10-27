import "@testing-library/jest-dom/vitest";
import { MotionGlobalConfig } from "motion/react";

// Tests assert on state, not on animation frames: finish every transition instantly.
MotionGlobalConfig.skipAnimations = true;

// jsdom has no ResizeObserver; Radix primitives (radio, select) measure themselves with it.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
