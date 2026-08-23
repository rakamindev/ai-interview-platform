import "@testing-library/jest-dom/vitest";

declare const process: { env: Record<string, string> };
process.env.TZ = "UTC";
