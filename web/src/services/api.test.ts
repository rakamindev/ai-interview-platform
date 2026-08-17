import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The response interceptor used to redirect on 401 *and* 403, for every
 * request including the sign-in call itself. That reloaded the page before
 * React could render the message, so every failed sign-in showed a blink and
 * an empty form — the error text had never once reached a user.
 */

const { clearToken } = vi.hoisted(() => ({ clearToken: vi.fn() }));

vi.mock("@/stores/authAtom", () => ({
  getStoredToken: () => "token",
  clearToken,
}));

let onRejected: (error: unknown) => unknown;

vi.mock("axios", () => ({
  default: {
    create: () => ({
      interceptors: {
        request: { use: vi.fn() },
        response: {
          use: (_ok: unknown, err: (e: unknown) => unknown) => {
            onRejected = err;
          },
        },
      },
    }),
  },
}));

const failure = (status: number, url: string) => ({
  response: { status },
  config: { url },
});

let assigned: string | null;

beforeEach(async () => {
  vi.clearAllMocks();
  assigned = null;
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      get href() {
        return "http://localhost/";
      },
      set href(v: string) {
        assigned = v;
      },
    },
  });
  vi.resetModules();
  await import("@/services/api");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api response interceptor", () => {
  it("leaves a refused sign-in to the login form", async () => {
    await expect(onRejected(failure(403, "/auth/login"))).rejects.toBeDefined();

    expect(assigned).toBeNull();
    expect(clearToken).not.toHaveBeenCalled();
  });

  it("leaves a wrong password to the login form too", async () => {
    await expect(onRejected(failure(401, "/auth/login"))).rejects.toBeDefined();

    expect(assigned).toBeNull();
    expect(clearToken).not.toHaveBeenCalled();
  });

  it("signs you out when the session itself is no longer good", async () => {
    await expect(onRejected(failure(401, "/sessions/candidates"))).rejects.toBeDefined();

    expect(clearToken).toHaveBeenCalled();
    expect(assigned).toBe("/login");
  });

  it("does not throw away a working session over one refused request", async () => {
    // 403 means we know who you are and this particular thing is not yours.
    // Logging out for it loses everything else the session could still do.
    await expect(onRejected(failure(403, "/sessions/9/review"))).rejects.toBeDefined();

    expect(clearToken).not.toHaveBeenCalled();
    expect(assigned).toBeNull();
  });

  it("passes other failures straight through", async () => {
    await expect(onRejected(failure(500, "/sessions/candidates"))).rejects.toBeDefined();

    expect(clearToken).not.toHaveBeenCalled();
    expect(assigned).toBeNull();
  });
});
