import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

Object.defineProperty(Element.prototype, "hasPointerCapture", {
  value: vi.fn(() => false),
});

Object.defineProperty(Element.prototype, "setPointerCapture", {
  value: vi.fn(),
});

Object.defineProperty(Element.prototype, "releasePointerCapture", {
  value: vi.fn(),
});

Object.defineProperty(Element.prototype, "scrollIntoView", {
  value: vi.fn(),
});
