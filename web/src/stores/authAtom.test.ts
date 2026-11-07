import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.stubGlobal("localStorage", { getItem: () => null });
const { getStoredToken } = await import("./authAtom");

describe("development token boundary (B7)", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", { getItem: () => null });
    vi.stubEnv("VITE_DEV_TOKEN", "synthetic-development-token");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("does not use a configured development token in production", () => {
    vi.stubEnv("DEV", false);
    expect(getStoredToken()).toBeNull();
  });

  it("preserves the local development fallback", () => {
    vi.stubEnv("DEV", true);
    expect(getStoredToken()).toBe("synthetic-development-token");
  });

  it("still uses a stored login token in production", () => {
    vi.stubEnv("DEV", false);
    vi.stubGlobal("localStorage", { getItem: () => "synthetic-login-token" });
    expect(getStoredToken()).toBe("synthetic-login-token");
  });
});
