import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearToken, getStoredToken, saveToken } from "./authAtom";

describe("auth token storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not unlock authentication from VITE_DEV_TOKEN alone", () => {
    vi.stubEnv("VITE_DEV_TOKEN", "development-token");

    expect(getStoredToken()).toBeNull();
  });

  it("returns a token saved after a successful login", () => {
    saveToken("login-token");

    expect(getStoredToken()).toBe("login-token");
  });

  it("clears the stored auth token and alternate token keys on logout", () => {
    localStorage.setItem("auth_token", "auth-token");
    localStorage.setItem("access_token", "access-token");
    localStorage.setItem("refresh_token", "refresh-token");
    localStorage.setItem("session-token", "session-token");
    localStorage.setItem("unrelated_setting", "keep-me");

    clearToken();

    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(localStorage.getItem("access_token")).toBeNull();
    expect(localStorage.getItem("refresh_token")).toBeNull();
    expect(localStorage.getItem("session-token")).toBeNull();
    expect(localStorage.getItem("unrelated_setting")).toBe("keep-me");
  });
});
