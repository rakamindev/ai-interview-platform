import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Vitest does not clean the DOM between tests on its own.
afterEach(() => cleanup());
