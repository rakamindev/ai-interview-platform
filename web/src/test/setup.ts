import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./server";

// Pages chain requests (session, then portfolio, then report); 1s, the default,
// is too tight when the whole suite runs in parallel.
configure({ asyncUtilTimeout: 3000 });

// A request without a handler fails the test, so a page can't quietly call an
// endpoint the test didn't account for. MSW's "error" strategy alone only turns
// the request into a network error, which a page that swallows errors (e.g.
// `.catch(() => {})`) would hide, so unhandled requests are also collected here
// and reported after each test.
const unhandled: string[] = [];

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
  server.events.on("request:unhandled", ({ request }) => {
    unhandled.push(`${request.method} ${request.url}`);
  });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  localStorage.clear();

  if (unhandled.length > 0) {
    const requests = unhandled.splice(0);
    throw new Error(`Requests without a test handler:\n  ${requests.join("\n  ")}`);
  }
});

afterAll(() => server.close());

// jsdom lacks these browser APIs; Radix UI calls them when menus and dialogs open.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = () => {};
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
