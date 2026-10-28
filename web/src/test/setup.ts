import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

// Vitest runs without globals, so Testing Library cannot install its own
// auto-cleanup: without this, each render leaks into the next example and
// queries start matching several nodes at once.
afterEach(() => {
    cleanup();
});
