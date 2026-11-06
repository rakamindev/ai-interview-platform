// Matcher DOM (toBeInTheDocument, toHaveTextContent, ...) untuk expect Vitest.
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Tanpa `globals: true`, Testing Library tidak membersihkan DOM otomatis.
afterEach(() => {
  cleanup();
});
