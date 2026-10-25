import "@testing-library/jest-dom/vitest";

// jsdom lacks ResizeObserver — required by Radix UI primitives.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}
