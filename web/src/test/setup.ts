// DOM matchers (toBeInTheDocument, toHaveTextContent, ...) for Vitest's expect.
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Without `globals: true`, Testing Library does not clean up the DOM automatically.
afterEach(() => {
  cleanup();
});
