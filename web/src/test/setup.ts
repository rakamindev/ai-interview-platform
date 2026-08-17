import "@testing-library/jest-dom/vitest";

// Match the class-variance-authority / tailwind-merge usage without real styles.
// jsdom has no layout engine; these mocks keep Radix/animate deps happy in tests.

import { vi } from "vitest";

// Simple matchMedia stub required by some Radix/Tailwind helpers in jsdom.
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

// ResizeObserver stub (used by Radix primitives).
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = window.ResizeObserver ?? (ResizeObserverStub as unknown as typeof ResizeObserver);