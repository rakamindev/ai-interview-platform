import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getStoredToken, saveToken, clearToken } from "./authAtom";

describe("getStoredToken", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the stored token when one exists", () => {
    saveToken("real-user-token");
    expect(getStoredToken()).toBe("real-user-token");
  });

  it("returns null when nothing is stored and no dev token is configured", () => {
    vi.stubEnv("VITE_DEV_TOKEN", "");
    expect(getStoredToken()).toBeNull();
  });

  it("falls back to VITE_DEV_TOKEN in dev mode when nothing is stored", () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_DEV_TOKEN", "dev-only-token");

    expect(getStoredToken()).toBe("dev-only-token");
  });

  it("never falls back to VITE_DEV_TOKEN outside dev mode (prod bundles)", () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_DEV_TOKEN", "dev-only-token");

    expect(getStoredToken()).toBeNull();
  });

  it("prefers a real stored token over the dev fallback", () => {
    saveToken("real-user-token");
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_DEV_TOKEN", "dev-only-token");

    expect(getStoredToken()).toBe("real-user-token");
  });

  it("clearToken removes the stored token so the dev fallback can't resurrect a session silently in prod", () => {
    saveToken("real-user-token");
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_DEV_TOKEN", "dev-only-token");

    clearToken();

    expect(getStoredToken()).toBeNull();
  });
});
