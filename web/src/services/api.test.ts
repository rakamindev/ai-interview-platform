import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AxiosAdapter } from "axios";
import { api } from "./api";

function respondWith(status: number): AxiosAdapter {
  return (config) =>
    Promise.reject({ config, response: { status, data: {}, config, headers: {}, statusText: "" }, isAxiosError: true });
}

describe("api client", () => {
  let hrefSetter: ReturnType<typeof vi.fn<(v: string) => void>>;
  const originalAdapter = api.defaults.adapter;

  beforeEach(() => {
    hrefSetter = vi.fn<(v: string) => void>();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { pathname: "/assessments", set href(v: string) { hrefSetter(v); }, get href() { return ""; } },
    });
    localStorage.setItem("token", "t");
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
  });

  it("sends an expired session back to /login", async () => {
    api.defaults.adapter = respondWith(401);

    await expect(api.get("/assessments")).rejects.toBeDefined();

    expect(hrefSetter).toHaveBeenCalledWith("/login");
  });

  // Regression: a wrong password is a 401 from POST /auth/login. Redirecting to /login
  // reloads the page and wipes the "wrong email or password" message before it is seen.
  it("does not reload the login page when the login request itself fails", async () => {
    api.defaults.adapter = respondWith(401);

    await expect(api.post("/auth/login", {})).rejects.toBeDefined();

    expect(hrefSetter).not.toHaveBeenCalled();
  });

  it("has a request timeout so a hung backend does not spin forever", () => {
    expect(api.defaults.timeout).toBeGreaterThan(0);
  });
});
