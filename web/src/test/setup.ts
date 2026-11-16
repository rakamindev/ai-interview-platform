// src/test/setup.ts
import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

// jsdom lacks these; Radix (Select, Tooltip) and your audio code need them
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
window.HTMLElement.prototype.scrollIntoView ??= () => {};
window.HTMLElement.prototype.hasPointerCapture ??= () => false;