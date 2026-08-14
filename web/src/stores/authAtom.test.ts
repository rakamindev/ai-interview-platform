import { describe, it, expect, beforeEach, vi } from "vitest";
import { getStoredToken, saveToken, clearToken } from "./authAtom";

// Regression: assessment/gap-analysis.md P1-6 — getStoredToken() used to fall
// back to VITE_DEV_TOKEN whenever localStorage had no token, which meant a
// freshly-loaded app (never logged in) or a page reload right after logout
// would silently re-authenticate using whatever token was baked into the
// build, bypassing the login form entirely.
describe("getStoredToken", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when nothing is stored, even if VITE_DEV_TOKEN is set", () => {
    vi.stubEnv("VITE_DEV_TOKEN", "eyJhbGciOiJIUzI1NiJ9.fake.token");

    expect(getStoredToken()).toBeNull();

    vi.unstubAllEnvs();
  });

  it("still returns the real token once one has been saved", () => {
    saveToken("real-token");
    expect(getStoredToken()).toBe("real-token");
  });

  it("returns null after logout, regardless of VITE_DEV_TOKEN", () => {
    vi.stubEnv("VITE_DEV_TOKEN", "eyJhbGciOiJIUzI1NiJ9.fake.token");
    saveToken("real-token");

    clearToken();

    expect(getStoredToken()).toBeNull();

    vi.unstubAllEnvs();
  });
});
