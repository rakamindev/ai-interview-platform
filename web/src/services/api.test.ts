import { describe, it, expect, beforeEach, vi } from "vitest";
import type { InternalAxiosRequestConfig } from "axios";
import { api } from "./api";
import { saveToken, getStoredToken } from "@/stores/authAtom";

type Handler = (config: InternalAxiosRequestConfig) => { status: number; data: unknown };

function useAdapter(handler: Handler) {
  api.defaults.adapter = async (config) => {
    const { status, data } = handler(config);
    const response = { data, status, statusText: "", headers: {}, config };
    if (status >= 400) throw Object.assign(new Error(`HTTP ${status}`), { response, config });
    return response;
  };
}

beforeEach(() => {
  // jsdom can't navigate; replace location so the 401 redirect is observable.
  vi.stubGlobal("location", { href: "/" });
});

describe("api client", () => {
  it("sends the stored token as a Bearer header", async () => {
    saveToken("abc");
    let auth: unknown;
    useAdapter((config) => {
      auth = config.headers.Authorization;
      return { status: 200, data: {} };
    });
    await api.get("/ping");
    expect(auth).toBe("Bearer abc");
  });

  it("omits Authorization when there is no token", async () => {
    let auth: unknown = "unset";
    useAdapter((config) => {
      auth = config.headers.Authorization;
      return { status: 200, data: {} };
    });
    await api.get("/ping");
    expect(auth).toBeUndefined();
  });

  it("unwraps the { data } envelope", async () => {
    useAdapter(() => ({ status: 200, data: { data: { id: 1 } } }));
    const res = await api.get("/things/1");
    expect(res.data).toEqual({ id: 1 });
  });

  it("leaves non-enveloped bodies alone", async () => {
    useAdapter(() => ({ status: 200, data: { id: 1 } }));
    const res = await api.get("/things/1");
    expect(res.data).toEqual({ id: 1 });
  });

  it.each([401, 403])("clears the token and redirects to /login on %i", async (status) => {
    saveToken("abc");
    useAdapter(() => ({ status, data: {} }));
    await expect(api.get("/secret")).rejects.toBeTruthy();
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(window.location.href).toBe("/login");
  });

  it("does not clear the token on other errors", async () => {
    saveToken("abc");
    useAdapter(() => ({ status: 500, data: {} }));
    await expect(api.get("/boom")).rejects.toBeTruthy();
    expect(getStoredToken()).toBe("abc");
    expect(window.location.href).toBe("/");
  });
});
