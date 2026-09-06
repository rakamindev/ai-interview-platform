import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getStoredToken, saveToken, clearToken } from "./authAtom";

describe("auth storage helpers", () => {
  beforeEach(() => {
    localStorage.clear();
    // Neutralise the real VITE_DEV_TOKEN from .env so tests are deterministic.
    vi.stubEnv("VITE_DEV_TOKEN", undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("persists the token to localStorage", () => {
    saveToken("jwt-token");

    expect(localStorage.getItem("auth_token")).toBe("jwt-token");
  });

  it("reads back a stored token", () => {
    saveToken("jwt-token");

    expect(getStoredToken()).toBe("jwt-token");
  });

  it("falls back to VITE_DEV_TOKEN when nothing is stored", () => {
    vi.stubEnv("VITE_DEV_TOKEN", "dev-token");

    expect(getStoredToken()).toBe("dev-token");
  });

  it("returns null when nothing is stored and no dev token is set", () => {
    expect(getStoredToken()).toBeNull();
  });

  it("clears the stored token", () => {
    saveToken("jwt-token");
    clearToken();

    expect(getStoredToken()).toBeNull();
  });
});