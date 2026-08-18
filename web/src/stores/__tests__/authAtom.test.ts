import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearToken, getStoredToken, saveToken } from "@/stores/authAtom";

describe("authAtom token persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null when nothing is stored and no dev token is configured", () => {
    vi.stubEnv("VITE_DEV_TOKEN", undefined);

    expect(getStoredToken()).toBeNull();
  });

  it("saves and reads back a token from localStorage", () => {
    saveToken("abc.def.ghi");

    expect(getStoredToken()).toBe("abc.def.ghi");
    expect(localStorage.getItem("auth_token")).toBe("abc.def.ghi");
  });

  it("clears a stored token", () => {
    saveToken("abc.def.ghi");
    clearToken();

    expect(localStorage.getItem("auth_token")).toBeNull();
  });

  it("falls back to VITE_DEV_TOKEN only when localStorage is empty", () => {
    vi.stubEnv("VITE_DEV_TOKEN", "dev-fallback-token");

    expect(getStoredToken()).toBe("dev-fallback-token");

    saveToken("real-token");
    expect(getStoredToken()).toBe("real-token");
  });

  it("does NOT fall back to VITE_DEV_TOKEN when the stored token is an empty string", () => {
    // Explicitly stored empty string is a deliberate "logged out" signal —
    // distinct from "nothing stored" — and must not resurrect the dev token.
    vi.stubEnv("VITE_DEV_TOKEN", "dev-fallback-token");
    localStorage.setItem("auth_token", "");

    expect(getStoredToken()).toBe("");
  });
});
